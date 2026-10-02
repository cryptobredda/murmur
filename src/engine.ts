import { resample, wavBytes, validateEndpoint } from "./core.mjs";
import { supportsSpeechLanguage, type LocalModel, type Settings } from "./types";
export interface Progress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}
let speechModel: LocalModel | undefined;
const nativeJobs = new Set<string>();
async function nativeJob(id: string, onProgress?: (p: Progress) => void, signal?: AbortSignal) {
  const native = window.MurmurAndroid;
  if (!id || !native?.nativeSpeechStatus) throw new Error("Native speech recognition is unavailable.");
  nativeJobs.add(id);
  try {
    while (nativeJobs.has(id) && !signal?.aborted) {
      const job = JSON.parse(native.nativeSpeechStatus(id));
      if (job.state === "done") { onProgress?.({status:"done"}); return job; }
      if (job.state === "error") throw new Error(job.error || "Speech recognition failed. Your audio is saved.");
      onProgress?.({status:"progress",file:job.file || "Preparing speech model",loaded:job.loaded,total:job.total});
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new DOMException("Transcription cancelled. Your audio is saved.", "AbortError");
  } finally {
    nativeJobs.delete(id);
    if (signal?.aborted) native.cancelNativeSpeech?.(id);
  }
}
export async function isModelCached(model: LocalModel) {
  try { return JSON.parse(window.MurmurAndroid?.nativeSpeechModels?.() || "[]").includes(model); } catch { return false; }
}
export async function loadModel(model: LocalModel, onProgress: (p: Progress) => void, cacheOnly = false) {
  const native = window.MurmurAndroid;
  if (!native?.prepareNativeSpeech) throw new Error("Install the Android APK to run Parakeet locally.");
  await nativeJob(native.prepareNativeSpeech(model, cacheOnly), onProgress);
  speechModel = model;
}
export function cancelLocal() {
  for (const id of nativeJobs) window.MurmurAndroid?.cancelNativeSpeech?.(id);
  nativeJobs.clear();
  speechModel = undefined;
}
export async function localTranscribe(_audio: Float32Array, language: string, audioId?: string, fresh = false, signal?: AbortSignal) {
  if (!speechModel) throw new Error("Load Parakeet inside Murmur first.");
  if (!supportsSpeechLanguage(speechModel, language)) throw new Error("Parakeet supports 25 European languages. Select a supported language in Settings.");
  if (!audioId || !window.MurmurAndroid?.transcribeNativeAudio) throw new Error("A saved recording is required for native speech recognition.");
  return (await nativeJob(window.MurmurAndroid.transcribeNativeAudio(audioId, speechModel, fresh), undefined, signal)).text as string;
}
export async function cloudTranscribe(
  audio: Float32Array,
  settings: Settings,
  key: string,
  signal: AbortSignal,
) {
  const presets = {
    openai: {
      url: "https://api.openai.com/v1/audio/transcriptions",
      model: "whisper-1",
    },
    groq: {
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      model: "whisper-large-v3-turbo",
    },
  };
  const preset = presets[settings.provider as keyof typeof presets];
  const endpoint = validateEndpoint(preset?.url || settings.cloudEndpoint);
  if (!key && settings.provider !== "custom")
    throw new Error("Add your API key in Models & providers first.");
  const form = new FormData();
  form.append(
    "file",
    new Blob([wavBytes(audio)], { type: "audio/wav" }),
    "dictation.wav",
  );
  form.append("model", preset?.model || settings.cloudModel);
  form.append("response_format", "json");
  if (settings.language !== "auto") form.append("language", settings.language);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      body: form,
      signal,
    });
  } catch (e) {
    if (signal.aborted)
      throw new Error(
        "Cloud request cancelled or timed out. Your recording is saved in History.",
      );
    throw new Error(
      "Cannot reach the provider. Check your connection and whether the endpoint allows browser requests (CORS).",
    );
  }
  if (!response.ok) {
    const reasons: Record<number, string> = {
      401: "The provider rejected your API key.",
      403: "The provider denied access to this model.",
      413: "The recording is too large for this provider.",
      429: "The provider has reached a usage or rate limit.",
    };
    throw new Error(
      reasons[response.status] ||
        `The provider returned an error (${response.status}).`,
    );
  }
  const result = await response.json();
  if (typeof result.text !== "string")
    throw new Error("The provider did not return a text transcription.");
  return result.text as string;
}
export class Recorder {
  private context?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private chunks: Float32Array[] = [];
  async start(onLevel: (n: number) => void) {
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Recording needs HTTPS and a browser with microphone support.",
        );
      this.context = new AudioContext();
      await this.context.resume();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      await this.context.audioWorklet.addModule("/pcm-worklet.js");
      this.node = new AudioWorkletNode(this.context, "murmur-capture");
      this.chunks = [];
      this.node.port.onmessage = (e) => {
        if (e.data.type === "flush") {
          this.flushResolve?.();
          return;
        }
        const chunk = e.data as Float32Array;
        this.chunks.push(chunk);
        let sum = 0;
        for (const n of chunk) sum += n * n;
        onLevel(Math.min(1, Math.sqrt(sum / chunk.length) * 12));
      };
      this.source = this.context.createMediaStreamSource(this.stream);
      const mute = this.context.createGain();
      mute.gain.value = 0;
      this.source.connect(this.node);
      this.node.connect(mute);
      mute.connect(this.context.destination);
    } catch (error) {
      await this.cleanup();
      if (error instanceof DOMException && error.name === "NotAllowedError")
        throw new Error(
          "Microphone access was declined. Allow the microphone in your browser’s site settings, then try again.",
        );
      if (
        error instanceof DOMException &&
        ["NotReadableError", "AbortError"].includes(error.name)
      )
        throw new Error(
          "The microphone could not start. Close calls or other recording apps, check microphone access in device settings, then try again.",
        );
      throw error;
    }
  }
  private flushResolve?: () => void;
  async stop() {
    if (this.node) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 350);
        this.flushResolve = () => {
          clearTimeout(timer);
          resolve();
        };
        this.node!.port.postMessage("flush");
      });
    }
    const rate = this.context?.sampleRate || 48000;
    const length = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const audio = new Float32Array(length);
    let offset = 0;
    for (const chunk of this.chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }
    await this.cleanup();
    return resample(audio, rate, 16000);
  }
  async cleanup() {
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.context && this.context.state !== "closed")
      await this.context.close();
    this.context = undefined;
    this.stream = undefined;
    this.node = undefined;
    this.source = undefined;
    this.chunks = [];
  }
}

export class NativeRecorder {
  private timer?: ReturnType<typeof setInterval>;
  private cancelled = false;
  elapsed = 0;
  audioId = "";
  private sampleRate = 16000;
  async start(onLevel: (value: number) => void) {
    const native = window.MurmurAndroid;
    if (!native?.startNativeRecording || !native.microphonePermission)
      throw new Error("Native microphone capture is unavailable.");
    this.cancelled = false;
    if (native.microphonePermission() !== "granted") {
      native.requestMicrophonePermission?.();
      const deadline = Date.now() + 60000;
      while (
        native.microphonePermission() === "pending" &&
        Date.now() < deadline &&
        !this.cancelled
      )
        await new Promise((r) => setTimeout(r, 150));
      if (this.cancelled) return;
      if (native.microphonePermission() !== "granted")
        throw new Error(
          "Microphone access was declined. Allow it in Android app settings and try again.",
        );
    }
    let state = JSON.parse(native.nativeRecordingStatus?.() || "{}");
    if (!state.recording && !state.ready) {
      if (!native.startNativeRecording())
        throw new Error(
          JSON.parse(native.nativeRecordingStatus?.() || "{}").error ||
            "Android could not start the microphone. Check microphone access in Android Settings.",
        );
      const deadline = Date.now() + 10000;
      do {
        await new Promise((r) => setTimeout(r, 100));
        state = JSON.parse(native.nativeRecordingStatus?.() || "{}");
        if (state.error) throw new Error(state.error);
      } while (
        !state.recording &&
        !state.ready &&
        Date.now() < deadline &&
        !this.cancelled
      );
      if (!state.recording && !state.ready)
        throw new Error("The microphone did not start. Try again.");
    }
    this.elapsed = state.seconds || 0;
    this.audioId = state.audioId || "";
    this.sampleRate = state.sampleRate || 16000;
    if (this.cancelled) {
      native.cancelNativeRecording?.();
      return;
    }
    this.timer = setInterval(() => {
      try {
        const status = JSON.parse(native.nativeRecordingStatus?.() || "{}");
        onLevel(status.level || 0);
        if (status.error)
          window.dispatchEvent(
            new CustomEvent("murmur-native-recording-error", {
              detail: status.error,
            }),
          );
        if (!status.recording && !status.ready)
          window.dispatchEvent(new Event("murmur-native-recording-stopped"));
      } catch {}
    }, 120);
  }
  async stop(decode = true) {
    clearInterval(this.timer);
    if (!decode && window.MurmurAndroid?.freezeNativeRecording) {
      window.MurmurAndroid.freezeNativeRecording();
      return new Float32Array(0);
    }
    const encoded = window.MurmurAndroid?.finishNativeRecording?.() || "";
    if (!encoded) throw new Error("No audio was captured.");
    const bytes = Uint8Array.from(atob(encoded), (x) => x.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const audio = new Float32Array(Math.floor(bytes.length / 2));
    for (let i = 0; i < audio.length; i++)
      audio[i] = view.getInt16(i * 2, true) / 32768;
    return resample(audio, this.sampleRate, 16000);
  }
  async cleanup() {
    this.cancelled = true;
    clearInterval(this.timer);
    window.MurmurAndroid?.cancelNativeRecording?.();
  }
}
