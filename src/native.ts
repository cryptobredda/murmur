export interface AndroidLaunch { version: string; }
export interface AndroidDevice {
  model: string;
  androidVersion: string;
  sdk: number;
  ramBytes: number;
  freeStorageBytes: number;
  arm64: boolean;
  soc: string;
}
interface AndroidBridge {
  getLaunchContext(): string;
  copyText(text: string): boolean;
  exportText(name: string, text: string, type: string): boolean;
  deviceInfo?(): string;
  accessibilityEnabled?(): boolean;
  openAccessibilitySettings?(): void;
  configureOverlay?(enabled: boolean, learn: boolean): void;
  configureOverlayAppearance?(opacity: number): void;
  overlayStatus?(): string;
  resumeOverlay?(): void;
  microphonePermission?(): string;
  requestMicrophonePermission?(): void;
  openAppSettings?(): void;
  startNativeRecording?(): boolean;
  nativeRecordingStatus?(): string;
  finishNativeRecording?(): string;
  freezeNativeRecording?(): void;
  cancelNativeRecording?(): void;
  takeLearnedWords?(): string;
  readSecret?(slot: string): string;
  setSessionSecret?(slot: string,value: string): boolean;
  backgroundReady?(): void;
  backgroundResult?(id: string,text: string,clipboard: boolean,error: string): void;
  isBackgroundRequestCurrent?(id: string): boolean;
  backgroundBusy?(): boolean;
  pauseBackgroundEngine?(): void;
  resumeBackgroundEngine?(): void;
  writeSecret?(slot: string, value: string): boolean;
  configureSpeech?(provider: string, model: string): void;
  nativeSpeechModels?(): string;
  prepareNativeSpeech?(model: string, cacheOnly: boolean): string;
  nativeSpeechStatus?(job: string): string;
  cancelNativeSpeech?(job: string): void;
  removeNativeSpeech?(model: string): boolean;
  transcribeNativeAudio?(id: string, model: string, fresh: boolean): string;
  editNativeWriting?(model: string, messages: string, maxTokens: number): string;
  nativeEditingStatus?(job: string): string;
  cancelNativeEditing?(job: string): void;
  listNativeAudio?(): string;
  nativeAudioInfo?(id: string): string;
  readNativeAudio?(id: string): string;
  nativeAudioUrl?(id: string): string;
  updateNativeAudio?(id: string, value: string): boolean;
  deleteNativeAudio?(id: string): boolean;
  beginSavedProcessing?(id: string): boolean;
  completeAudioProcessing?(id: string): void;
  exportNativeAudio?(id: string): boolean;
}
declare global {
  interface Window {
    MurmurAndroid?: AndroidBridge;
  }
}
export function androidBridge() {
  return typeof window === "undefined" ? undefined : window.MurmurAndroid;
}
export function androidLaunch(): AndroidLaunch {
  try {
    const result = JSON.parse(androidBridge()?.getLaunchContext() || "{}");
    return { version: typeof result.version === "string" ? result.version : "" };
  } catch { return { version: "" }; }
}
export function androidDevice(): AndroidDevice | null {
  try {
    const result = JSON.parse(androidBridge()?.deviceInfo?.() || "null");
    return result && typeof result.ramBytes === "number" && typeof result.sdk === "number" ? result : null;
  } catch { return null; }
}
