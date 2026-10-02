import { validateBackup, validateEndpoint } from "./core.mjs";
const encode = (b) => {
  const chunks = [];
  for (let i = 0; i < b.length; i += 8192)
    chunks.push(String.fromCharCode(...b.subarray(i, i + 8192)));
  return btoa(chunks.join(""));
};
const decode = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function key(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length < 8)
    throw new Error("Use a sync passphrase with at least eight characters.");
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptSnapshot(snapshot, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await key(passphrase, salt),
      new TextEncoder().encode(JSON.stringify(snapshot)),
    ),
  );
  return {
    app: "murmur-encrypted",
    version: 1,
    salt: encode(salt),
    iv: encode(iv),
    data: encode(encrypted),
  };
}
export async function decryptSnapshot(envelope, passphrase) {
  if (
    envelope?.app !== "murmur-encrypted" ||
    envelope.version !== 1 ||
    typeof envelope.data !== "string" ||
    envelope.data.length > 40000000
  )
    throw new Error(
      "The server file is not a supported encrypted Murmur backup.",
    );
  try {
    const salt = decode(envelope.salt),
      iv = decode(envelope.iv);
    if (salt.length !== 16 || iv.length !== 12) throw Error();
    const bytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await key(passphrase, salt),
      decode(envelope.data),
    );
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error(
      "Could not decrypt the sync file. Check the passphrase; the file may also be damaged.",
    );
  }
}
export function mergeSnapshots(local, remote, scope = "all") {
  validateBackup(local);
  if (remote) validateBackup(remote);
  const deleted = new Map();
  for (const item of [
    ...(remote?.deletions || []),
    ...(local.deletions || []),
  ]) {
    if (
      !["history", "words", "snippets"].includes(item.store) ||
      typeof item.id !== "string" ||
      !Number.isFinite(item.time)
    )
      throw new Error("The sync file contains invalid deletions.");
    const k = item.store + ":" + item.id;
    if (!deleted.has(k) || deleted.get(k).time < item.time)
      deleted.set(k, item);
  }
  const merge = (store, field) => {
    const rows = new Map();
    for (const row of [...(remote?.[field] || []), ...local[field]]) {
      const before = rows.get(row.id),
        time = row.updatedAt || row.createdAt || 0;
      if (!before || (before.updatedAt || before.createdAt || 0) <= time)
        rows.set(row.id, row);
    }
    return [...rows.values()].filter(
      (row) =>
        !deleted.has(store + ":" + row.id) ||
        deleted.get(store + ":" + row.id).time <
          (row.updatedAt || row.createdAt || 0),
    );
  };
  return {
    app: "murmur",
    version: 1,
    transcripts:
      scope === "vocabulary"
        ? local.transcripts
        : merge("history", "transcripts"),
    words: merge("words", "words"),
    snippets: merge("snippets", "snippets"),
    deletions: [...deleted.values()],
    preferences: normalizeSyncPreferences(
      (remote?.preferences?.preferencesUpdatedAt || 0) >
        (local.preferences?.preferencesUpdatedAt || 0)
        ? remote.preferences
        : local.preferences || {},
    ),
    exportedAt: new Date().toISOString(),
  };
}
export function syncPreferences(settings) {
  const {
    language,
    style,
    tone,
    removeFillers,
    voiceCommands,
    correctSpeech,
    formatLists,
    autoLearn,
    profiles,
    preferencesUpdatedAt,
  } = settings;
  return {
    language,
    style,
    tone,
    removeFillers,
    voiceCommands,
    correctSpeech,
    formatLists,
    autoLearn,
    profiles,
    preferencesUpdatedAt,
  };
}
export async function synchronize(local, credentials, scope, signal) {
  const endpoint = validateEndpoint(credentials.endpoint);
  if (credentials.passphrase.length < 8)
    throw new Error("Enter a sync passphrase with at least eight characters.");
  const headers = credentials.username
    ? {
        Authorization:
          "Basic " +
          encode(
            new TextEncoder().encode(
              credentials.username + ":" + credentials.password,
            ),
          ),
      }
    : {};
  let remote = null,
    etag = "";
  const response = await fetch(endpoint, { headers, signal });
  if (response.status !== 404) {
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "The sync server rejected your credentials."
          : `Cannot read the sync file (${response.status}).`,
      );
    if (Number(response.headers.get("content-length")) > 40000000)
      throw new Error("The sync file is too large.");
    remote = await decryptSnapshot(
      await response.json(),
      credentials.passphrase,
    );
    etag = response.headers.get("ETag") || "";
    if (!etag || /^W\//i.test(etag))
      throw new Error(
        "The sync server must return a strong ETag and expose it through CORS. No remote data was overwritten.",
      );
  }
  const merged = mergeSnapshots(local, remote, scope);
  const upload = {
    ...merged,
    transcripts: scope === "vocabulary" ? [] : merged.transcripts,
    preferences: scope === "vocabulary" ? {} : merged.preferences,
    deletions:
      scope === "vocabulary"
        ? merged.deletions.filter((d) => d.store !== "history")
        : merged.deletions,
  };
  const encrypted = await encryptSnapshot(upload, credentials.passphrase);
  const put = await fetch(endpoint, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      ...(etag
        ? { "If-Match": etag }
        : response.status === 404
          ? { "If-None-Match": "*" }
          : {}),
    },
    body: JSON.stringify(encrypted),
    signal,
  });
  if (!put.ok)
    throw new Error(
      put.status === 412
        ? "Another device updated this file. Retry to merge its changes."
        : `The server could not save the sync file (${put.status}).`,
    );
  return merged;
}

export function normalizeSyncPreferences(input) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const name of [
    "removeFillers",
    "voiceCommands",
    "correctSpeech",
    "formatLists",
    "autoLearn",
  ])
    if (typeof input[name] === "boolean") result[name] = input[name];
  if (
    typeof input.language === "string" &&
    /^(?:auto|[a-z]{2,3})$/.test(input.language)
  )
    result.language = input.language;
  if (["natural", "polished", "verbatim"].includes(input.style))
    result.style = input.style;
  if (["neutral", "formal", "casual", "very-casual"].includes(input.tone))
    result.tone = input.tone;
  if (
    Number.isFinite(input.preferencesUpdatedAt) &&
    input.preferencesUpdatedAt >= 0
  )
    result.preferencesUpdatedAt = input.preferencesUpdatedAt;
  if (Array.isArray(input.profiles) && input.profiles.length <= 100) {
    const profiles = input.profiles.filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        p.name.length <= 60 &&
        typeof p.packages === "string" &&
        p.packages.length <= 300 &&
        ["neutral", "formal", "casual", "very-casual"].includes(p.tone) &&
        ["auto", "email", "list", "code"].includes(p.format) &&
        typeof p.instruction === "string" &&
        p.instruction.length <= 500,
    );
    if (profiles.length === input.profiles.length)
      result.profiles = profiles.map(
        ({ id, name, packages, tone, format, instruction }) => ({
          id,
          name,
          packages,
          tone,
          format,
          instruction,
        }),
      );
  }
  return result;
}
