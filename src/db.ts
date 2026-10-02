import { normalizeSettings, type Transcript, type Word, type Snippet, type Settings } from "./types";
import { androidBridge } from "./native";
import { resample, wavBytes } from "./core.mjs";
import { mergeSnapshots, syncPreferences } from "./sync.mjs";
let database: Promise<IDBDatabase> | undefined;
let obsoleteCacheCleanup: Promise<unknown> | undefined;
function open() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("murmur-local", 2);
      request.onupgradeneeded = () => {
        for (const name of ["history", "words", "snippets", "settings", "audio"])
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(
          new Error(
            "Device storage is unavailable. Allow app storage or leave private browsing.",
          ),
        );
      };
    });
  return database;
}
async function read<T>(store: string): Promise<T[]> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(store, "readonly")
      .objectStore(store)
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Unable to read device storage."));
  });
}
function finish(
  transaction: IDBTransaction,
  resolve: () => void,
  reject: (error: Error) => void,
) {
  transaction.oncomplete = resolve;
  transaction.onerror = () =>
    reject(new Error("Unable to save. Your device may be out of storage."));
  transaction.onabort = () =>
    reject(new Error("Saving was interrupted. Your text is still available."));
}
export async function put(store: string, value: unknown) {
  const database = await open();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).put(value);
    finish(transaction, resolve, reject);
  });
}
export async function remove(store: string, id: string) {
  const database = await open();
  if (store === "history" && androidBridge()?.deleteNativeAudio?.(id) === false)
    throw new Error("This recording could not be deleted. Finish the active dictation first.");
  return new Promise<void>((resolve, reject) => {
    const sync = ["history", "words", "snippets"].includes(store);
    const transaction = database.transaction(
      sync ? [store, "settings", ...(store === "history" ? ["audio"] : [])] : [store],
      "readwrite",
    );
    transaction.objectStore(store).delete(id);
    if (store === "history") transaction.objectStore("audio").delete(id);
    if (sync) {
      const settings = transaction.objectStore("settings");
      const request = settings.get("sync-deletions");
      request.onsuccess = () =>
        settings.put({
          id: "sync-deletions",
          value: [
            ...(request.result?.value || []).filter(
              (d: any) => d.store !== store || d.id !== id,
            ),
            { store, id, time: Date.now() },
          ],
        });
    }
    finish(transaction, resolve, reject);
  });
}
export async function load() {
  // Older Whisper/SmolLM browser downloads have no role in this version.
  if (!obsoleteCacheCleanup) obsoleteCacheCleanup = typeof caches !== "undefined" ? caches.delete("transformers-cache").catch(() => false) : Promise.resolve();
  await obsoleteCacheCleanup;
  const [history, words, snippets, settings] = await Promise.all([
    read<Transcript>("history"),
    read<Word>("words"),
    read<Snippet>("snippets"),
    read<{ id: string; value: Settings }>("settings"),
  ]);
  const clips = nativeRecordings();
  if (!androidBridge()?.listNativeAudio) for (const record of history)
    if(record.status === "processing" || record.status === "recording") {
      record.status="saved";record.error="Processing was interrupted. Your audio is saved.";
    }
  const deletions = settings.find(s => s.id === "sync-deletions")?.value as unknown as {store:string;id:string}[] | undefined;
  const deleted = new Set((deletions || []).filter(d => d.store === "history").map(d => d.id));
  const rows = new Map(history.map(record => [record.id, record]));
  for (const clip of clips) {
    if (deleted.has(clip.id)) continue;
    const prior = rows.get(clip.id);
    if (prior && (prior.updatedAt || prior.createdAt) >= clip.updatedAt!) rows.set(clip.id,{...prior,audioId:clip.id});
    else rows.set(clip.id,{...clip,...prior, audioId:clip.id,
      status:prior?.status === "complete" && clip.status !== "complete" ? "complete" : clip.status,
      error:clip.error,attempts:clip.attempts,processingMs:clip.processingMs,
      text:clip.status === "complete" ? clip.text : prior?.text || clip.text,
      raw:clip.status === "complete" ? clip.raw : prior?.raw || clip.raw,
      updatedAt:Math.max(clip.updatedAt || 0,prior?.updatedAt || 0)});
  }
  const saved = settings.find(s => s.id === "preferences")?.value;
  const preferences = normalizeSettings(saved);
  if (saved && (saved.localModel !== preferences.localModel || saved.editingModel !== preferences.editingModel || saved.language !== preferences.language)) {
    await put("settings", { id: "preferences", value: preferences });
  }
  return {
    history: [...rows.values()].sort((a, b) => b.createdAt - a.createdAt),
    words,
    snippets,
    settings: preferences,
  };
}
export function nativeAudioInfo(id: string) {
  try { return JSON.parse(androidBridge()?.nativeAudioInfo?.(id) || "{}"); } catch { return {}; }
}
function nativeRecordings(): Transcript[] {
  try {
    const data=JSON.parse(androidBridge()?.listNativeAudio?.() || "[]");
    return data.map((clip: any): Transcript => ({
      id:clip.id,audioId:clip.id,text:clip.text || "",raw:clip.raw || "",
      createdAt:Number(clip.createdAt)||Date.now(),updatedAt:Number(clip.updatedAt)||Number(clip.createdAt)||0,
      duration:Number(clip.bytes)/(Number(clip.sampleRate || 16000)*2),source:clip.source || "local",model:clip.model || "Saved audio",style:clip.style || "natural",starred:false,
      status:clip.status || "saved",error:clip.error || "",attempts:Number(clip.attempts)||0,processingMs:Number(clip.processingMs)||0,
      targetApp:clip.targetApp,mode:clip.mode === "command" ? "command" : "dictate",originalText:clip.originalText,instruction:clip.instruction,editingModel:clip.editingModel,requestedEditingModel:clip.requestedEditingModel,
    }));
  } catch { return []; }
}
export async function saveTranscript(record: Transcript) {
  if (record.audioId) androidBridge()?.updateNativeAudio?.(record.audioId, JSON.stringify(record));
  await put("history", record);
}
export async function saveRecording(audio: Float32Array, record: Transcript) {
  const native = androidBridge();
  if (record.audioId && Number(nativeAudioInfo(record.audioId).bytes)>0) {
    native?.updateNativeAudio?.(record.audioId,JSON.stringify(record));
    await put("history",record);return;
  }
  if (!audio.length) throw new Error("No audio was captured.");
  const database=await open();
  return new Promise<void>((resolve,reject)=>{
    const transaction=database.transaction(["history","audio"],"readwrite");
    transaction.objectStore("audio").put({id:record.audioId || record.id,data:audio.slice().buffer});
    transaction.objectStore("history").put(record);finish(transaction,resolve,reject);
  });
}
export async function readAudio(id: string): Promise<Float32Array> {
  const native=androidBridge(),encoded=native?.readNativeAudio?.(id);
  if (encoded) {
    const meta=nativeAudioInfo(id),bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
    const audio=new Float32Array(bytes.length/2);for(let i=0;i<audio.length;i++)audio[i]=view.getInt16(i*2,true)/32768;
    return resample(audio,Number(meta.sampleRate)||16000,16000);
  }
  const database=await open();
  return new Promise((resolve,reject)=>{
    const request=database.transaction("audio","readonly").objectStore("audio").get(id);
    request.onsuccess=()=>request.result?.data ? resolve(new Float32Array(request.result.data)) : reject(new Error("This recording's audio is unavailable on this device."));
    request.onerror=()=>reject(new Error("Could not read the saved recording."));
  });
}
export async function audioBlob(id: string) { return new Blob([wavBytes(await readAudio(id))],{type:"audio/wav"}); }
export function credentialScope(provider: string, endpoint: string) {
  return provider === "custom" ? endpoint.trim() : provider;
}
export async function readSecret(slot = "speech", scope?: string) {
  let needsBinding = false;
  if (scope !== undefined) {
    const bound = (await read<{id: string; value: string}>("settings")).find(x => x.id === "secret-scope-" + slot)?.value;
    if (bound !== undefined && bound !== scope) return "";
    needsBinding = bound === undefined;
  }
  const native = androidBridge();
  if (native?.readSecret) {
    const key = native.readSecret(slot);
    if (key) {
      if (needsBinding) await put("settings", {id: "secret-scope-" + slot, value: scope});
      return key;
    }
  }
  const id = slot === "speech" ? "api-key" : slot + "-key";
  const legacy =
    (await read<{ id: string; value: string }>("settings")).find(
      (s) => s.id === id,
    )?.value || "";
  if (legacy && native?.writeSecret && native.writeSecret(slot, legacy))
    await remove("settings", id);
  if (legacy && needsBinding) await put("settings", {id: "secret-scope-" + slot, value: scope});
  return legacy;
}
export async function saveSecret(slot: string, key: string, remember: boolean, scope?: string) {
  const native = androidBridge(),
    id = slot === "speech" ? "api-key" : slot + "-key";
  if (native?.writeSecret) {
    native.setSessionSecret?.(slot,key);
    if (!native.writeSecret(slot, remember ? key : ""))
      throw new Error("Android could not save the provider key.");
    await remove("settings", id);
  } else if (remember) await put("settings", { id, value: key });
  else await remove("settings", id);
  if (scope !== undefined) await put("settings", {id: "secret-scope-" + slot, value: scope});
}
export async function restore(data: {
  transcripts: Transcript[];
  words: Word[];
  snippets: Snippet[];
}) {
  const database = await open();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      ["history", "words", "snippets", "settings"],
      "readwrite",
    );
    for (const x of data.transcripts) transaction.objectStore("history").put(x);
    for (const x of data.words) transaction.objectStore("words").put(x);
    for (const x of data.snippets) transaction.objectStore("snippets").put(x);
    const settings = transaction.objectStore("settings"),
      request = settings.get("sync-deletions");
    request.onsuccess = () => {
      const imported = new Set([
        ...data.transcripts.map((x) => "history:" + x.id),
        ...data.words.map((x) => "words:" + x.id),
        ...data.snippets.map((x) => "snippets:" + x.id),
      ]);
      settings.put({
        id: "sync-deletions",
        value: (request.result?.value || []).filter(
          (d: any) => !imported.has(d.store + ":" + d.id),
        ),
      });
    };
    finish(transaction, resolve, reject);
  });
}
export async function clearHistory() {
  const database = await open();
  for (const record of nativeRecordings())
    if (androidBridge()?.deleteNativeAudio?.(record.id) === false) throw new Error("Finish the active dictation before clearing History.");
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      ["history", "settings", "audio"],
        "readwrite",
      ),
      history = transaction.objectStore("history"),
      settings = transaction.objectStore("settings");
    const existing = history.getAllKeys();
    existing.onsuccess = () => {
      const request = settings.get("sync-deletions");
      request.onsuccess = () => {
        const prior = (request.result?.value || []).filter(
          (d: any) => d.store !== "history",
        );
        settings.put({
          id: "sync-deletions",
          value: [
            ...prior,
            ...existing.result.map((id) => ({
              store: "history",
              id,
              time: Date.now(),
            })),
          ],
        });
        history.clear();
        transaction.objectStore("audio").clear();
      };
    };
    finish(transaction, resolve, reject);
  });
}
export async function readDeletions() {
  return (
    (await read<{ id: string; value: any }>("settings")).find(
      (x) => x.id === "sync-deletions",
    )?.value || []
  );
}
export async function applySync(data: {
  transcripts: Transcript[];
  words: Word[];
  snippets: Snippet[];
  deletions: any[];
  preferences?: unknown;
}) {
  const database = await open();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      ["history", "words", "snippets", "settings"],
      "readwrite",
    );
    const snapshot: Record<string, any[]> = {};
    const stores = ["history", "words", "snippets", "settings"];
    let completed = 0;
    for (const store of stores) {
      const request = transaction.objectStore(store).getAll();
      request.onsuccess = () => {
        snapshot[store] = request.result;
        if (++completed !== stores.length) return;
        try {
          const preferences =
            snapshot.settings.find((x) => x.id === "preferences")?.value || {};
          const current = {
            app: "murmur",
            version: 1,
            transcripts: snapshot.history,
            words: snapshot.words,
            snippets: snapshot.snippets,
            deletions:
              snapshot.settings.find((x) => x.id === "sync-deletions")?.value ||
              [],
            preferences: syncPreferences(preferences),
          };
          // Merge again inside the write transaction: dictations or edits saved
          // during a network request must not be overwritten by an older snapshot.
          const merged = mergeSnapshots(current, {
            ...data,
            app: "murmur",
            version: 1,
          });
          for (const [name, rows] of [
            ["history", merged.transcripts],
            ["words", merged.words],
            ["snippets", merged.snippets],
          ] as const) {
            const objectStore = transaction.objectStore(name);
            objectStore.clear();
            for (const row of rows) objectStore.put(row);
          }
          const objectStore = transaction.objectStore("settings");
          objectStore.put({ id: "sync-deletions", value: merged.deletions });
          objectStore.put({
            id: "preferences",
            value: { ...preferences, ...merged.preferences },
          });
        } catch (e) {
          transaction.abort();
          reject(
            e instanceof Error
              ? e
              : new Error("Cannot merge the synchronized data."),
          );
        }
      };
    }
    finish(transaction, resolve, reject);
  });
}
