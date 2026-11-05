import { useState, useEffect, type ReactNode } from "react";
import {
  Mic,
  Download,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Cloud,
  LoaderCircle,
  AudioLines,
} from "lucide-react";
import {
  models,
  speechModelOptions,
  languageOptions,
  type Settings,
  type LocalModel,
  type Provider,
} from "./types";
import { androidBridge } from "./native";
import { DeviceGuidance } from "./DeviceGuidance";
import { EditingSettings } from "./EditingSettings";
import type { EditingDownload } from "./useEditingModel";
interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<boolean>;
  ready: LocalModel | null;
  loading: LocalModel | null;
  progress: number;
  detail: string;
  error: string;
  cached: LocalModel[];
  prepare: (model: LocalModel) => Promise<void>;
  cancel: () => void;
  editing: EditingDownload;
  editingKey: string;
  saveEditingKey: (key: string, remember: boolean) => Promise<void>;
  speechKey: string;
  saveSpeech: (
    provider: Provider,
    endpoint: string,
    model: string,
    key: string,
    remember: boolean,
  ) => Promise<void>;
  finish: () => Promise<void>;
  phase: string;
  captureError: string;
  recordButton: ReactNode;
  result: string;
  cancelRecording: () => void;
}
export function Onboarding(p: Props) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const [step, setStep] = useState(0),
    [cloudKey, setCloudKey] = useState(p.speechKey),
    [cloudEndpoint, setCloudEndpoint] = useState(p.settings.cloudEndpoint),
    [cloudModel, setCloudModel] = useState(p.settings.cloudModel),
    [remember, setRemember] = useState(p.settings.rememberKey),
    [cloudError, setCloudError] = useState(""),
    [saving, setSaving] = useState(false),
    [permission, setPermission] = useState(false);
  const native = androidBridge();
  const steps = ["Welcome", "Speech model", "Writing", "Try it"];
  const speechReady =
    p.settings.provider === "local"
      ? p.ready === p.settings.localModel
      : p.settings.provider === "custom"
        ? !!p.settings.cloudEndpoint
        : !!p.speechKey;
  const editingReady =
    p.settings.editingProvider !== "local" ||
    p.editing.ready === p.settings.editingModel;
  const busy = p.phase !== "idle" || !!p.loading || !!p.editing.loading;
  useEffect(() => {
    const refresh = () =>
      setPermission(native?.accessibilityEnabled?.() === true);
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("murmur-native-launch", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("murmur-native-launch", refresh);
    };
  }, [native]);
  async function saveCloud() {
    setSaving(true);
    setCloudError("");
    try {
      await p.saveSpeech(
        p.settings.provider,
        cloudEndpoint,
        cloudModel,
        cloudKey,
        remember,
      );
    } catch (e) {
      setCloudError(
        e instanceof Error ? e.message : "Could not save your provider.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="onboarding-backdrop">
      <section
        className="onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <header className="setup-header">
          <div className="brand small">
            <AudioLines size={27} />
            <span>
              murmur<span className="brand-dot">.</span>
            </span>
          </div>
          <span>Free. Your device. Your voice.</span>
        </header>
        <div className="setup-steps" aria-label={`Setup step ${step + 1} of 4`}>
          {steps.map((name, i) => (
            <div
              key={name}
              className={i === step ? "active" : i < step ? "complete" : ""}
            >
              <span>{i < step ? <Check size={14} /> : i + 1}</span>
              <small>{name}</small>
            </div>
          ))}
        </div>
        <div className="setup-body">
          {step === 0 && (
            <>
              <div className="setup-hero-icon">
                <Mic size={40} />
              </div>
              <h1 id="setup-title">Your voice. Ready to go.</h1>
              <p className="setup-intro">
                A few minutes to set up dictation that works your way. Choose a
                model, download it here, and try your first recording.
              </p>
              <div className="setup-benefits">
                <p>
                  <ShieldCheck size={19} />
                  Free local models. No subscription.
                </p>
                <p>
                  <Download size={19} />
                  Every download happens inside Murmur.
                </p>
                <p>
                  <AudioLines size={19} />
                  Dictate where you type on Android.
                </p>
              </div>
              <label className="field-label">
                Your dictation language
                <select
                  aria-label="Setup language"
                  value={p.settings.language}
                  onChange={(e) => void p.update({ language: e.target.value })}
                >
                  {languageOptions(p.settings.provider,p.settings.localModel).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
                <span>
                  Automatic detection is available. Pick one language for better
                  accuracy.
                </span>
              </label>
              <div
                className="choice-grid two"
                role="group"
                aria-label="Setup transcription provider"
              >
                <button
                  className={`setup-choice ${p.settings.provider === "local" ? "selected" : ""}`}
                  onClick={() => void p.update({ provider: "local" })}
                >
                  <ShieldCheck size={20} />
                  <strong>On this device</strong>
                  <span>Free · works offline after download</span>
                </button>
                <button
                  className={`setup-choice ${p.settings.provider !== "local" ? "selected" : ""}`}
                  onClick={() => void p.update({ provider: "openai" })}
                >
                  <Cloud size={20} />
                  <strong>Your cloud provider</strong>
                  <span>Optional · use your own API key</span>
                </button>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 id="setup-title">Your speech model.</h1>
              <p className="setup-intro">
                {p.settings.provider === "local"
                  ? "Download once inside the app. Your recordings stay on your device."
                  : "Connect your provider here. Cloud recordings go directly to the selected endpoint."}
              </p>
              {p.settings.provider === "local" ? (
                <>
                  <div className="setup-models">
                    {speechModelOptions().map((model) => (
                      <article
                        key={model}
                        className={`setup-model ${p.settings.localModel === model ? "selected" : ""}`}
                      >
                        <label>
                          <input
                            type="radio"
                            name="setup-speech-model"
                            checked={p.settings.localModel === model}
                            disabled={!!p.loading}
                            onChange={() =>
                              void p.update({ localModel: model })
                            }
                          />
                          <div>
                            <strong>
                              {models[model].name}
                              <small>{models[model].label}</small>
                            </strong>
                            <span>{models[model].size} · {models[model].languages}</span>
                            <p>{models[model].description}</p>
                          </div>
                        </label>
                        {p.ready === model && <Check size={21} />}
                      </article>
                    ))}
                  </div>
                  {p.loading ? (
                    <div className="download-status" aria-live="polite">
                      <div className="progress-track">
                        <span style={{ width: p.progress + "%" }} />
                      </div>
                      <p>
                        <LoaderCircle className="spin" size={17} />
                        {p.detail}
                        <strong>{p.progress}%</strong>
                      </p>
                      <button className="button secondary" onClick={p.cancel}>
                        Cancel download
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button primary full-button"
                      disabled={speechReady || !native?.prepareNativeSpeech}
                      onClick={() => void p.prepare(p.settings.localModel)}
                    >
                      {speechReady ? (
                        <Check size={18} />
                      ) : (
                        <Download size={18} />
                      )}{" "}
                      {speechReady
                        ? "Speech model downloaded and ready"
                        : p.cached.includes(p.settings.localModel)
                          ? "Load your saved model"
                          : `Download ${models[p.settings.localModel].name}`}
                    </button>
                  )}
                  {p.error && (
                    <div className="notice error" role="alert">
                      <p>
                        {p.error} Check your connection and free storage, then retry here.
                      </p>
                    </div>
                  )}
                  <DeviceGuidance model={p.settings.localModel} />
                  <p className="fine-print">
                    Keep the app open while it downloads. Complete files are
                    saved and reused if you retry. Manage downloads later in Models.
                  </p>
                </>
              ) : (
                <>
                  <div
                    className="cloud-options"
                    role="group"
                    aria-label="Setup cloud provider"
                  >
                    {(["openai", "groq", "custom"] as Provider[]).map(
                      (provider) => (
                        <button
                          key={provider}
                          className={
                            p.settings.provider === provider ? "selected" : ""
                          }
                          onClick={() => void p.update({ provider })}
                        >
                          {provider === "openai"
                            ? "OpenAI"
                            : provider === "groq"
                              ? "Groq"
                              : "Custom endpoint"}
                        </button>
                      ),
                    )}
                  </div>
                  {p.settings.provider === "custom" && (
                    <>
                      <label className="field-label">
                        Transcription endpoint
                        <input
                          data-no-dictate
                          type="url"
                          value={cloudEndpoint}
                          onChange={(e) => setCloudEndpoint(e.target.value)}
                          placeholder="https://your-server/v1/audio/transcriptions"
                        />
                      </label>
                      <label className="field-label">
                        Model
                        <input
                          data-no-dictate
                          value={cloudModel}
                          onChange={(e) => setCloudModel(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  <label className="field-label">
                    Speech API key
                    <input
                      data-no-dictate
                      autoComplete="off"
                      type="password"
                      value={cloudKey}
                      onChange={(e) => setCloudKey(e.target.value)}
                      placeholder={
                        p.settings.provider === "custom"
                          ? "Optional for your server"
                          : "Enter your provider key"
                      }
                    />
                  </label>
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Remember key on this device
                  </label>
                  <button
                    className="button primary full-button"
                    disabled={
                      saving || (!cloudKey && p.settings.provider !== "custom")
                    }
                    onClick={() => void saveCloud()}
                  >
                    {saving
                      ? "Saving…"
                      : speechReady
                        ? "Update cloud provider"
                        : "Save cloud provider"}
                  </button>
                  <div className="notice warm">
                    <Cloud size={19} />
                    <p>
                      The app is free. Cloud providers may charge for usage.
                      Nothing is uploaded until you start a cloud recording.
                    </p>
                  </div>
                  {cloudError && (
                    <p role="alert" className="form-error">
                      {cloudError}
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h1 id="setup-title">Make your words feel like you.</h1>
              <p className="setup-intro">
                Smart cleanup is ready immediately. Add a local AI model for
                rewriting, or connect your own cloud editing provider.
              </p>
              <EditingSettings
                settings={p.settings}
                update={p.update}
                download={p.editing}
                saveKey={p.saveEditingKey}
                initialKey={p.editingKey}
                compact
              />
            </>
          )}
          {step === 3 && (
            <>
              <h1 id="setup-title">Give it a try.</h1>
              <p className="setup-intro">
                Try: “Let’s meet on Friday, actually Monday. Number one apples,
                number two bananas, number three oranges.”
              </p>
              <div
                className={`setup-test ${p.phase === "recording" ? "listening" : ""}`}
              >
                <AudioLines size={42} />
                {p.recordButton}
                {p.phase !== "idle" && (
                  <button className="text-button" onClick={p.cancelRecording}>
                    Cancel recording
                  </button>
                )}
                {native?.openAppSettings && p.phase === "idle" && (
                  <button
                    className="text-button"
                    onClick={() => native.openAppSettings?.()}
                  >
                    Microphone permissions
                  </button>
                )}
                {p.captureError && <p className="inline-error" role="alert">{p.captureError}</p>}
                {p.result && p.phase === "idle" && (
                  <blockquote aria-label="Setup test result">
                    {p.result}
                  </blockquote>
                )}
                <p>
                  {p.phase === "recording"
                    ? "Speak naturally, then tap Finish dictation."
                    : p.phase === "transcribing"
                      ? "Transcribing and cleaning up your words…"
                      : p.result
                        ? "Your first dictation is saved in History."
                        : "Your microphone permission is requested when you start."}
                </p>
              </div>
              {native && (
                <div className="setup-access">
                  <h3>Use the floating mic in other apps</h3>
                  <p>
                    Android asks you to enable Murmur’s accessibility service so
                    it can detect editable fields and insert your dictation. It
                    ignores password fields.
                  </p>
                  <button
                    className={`button ${permission ? "secondary" : "primary"}`}
                    onClick={() => native.openAccessibilitySettings?.()}
                  >
                    {permission ? <Check size={17} /> : <Mic size={17} />}{" "}
                    {permission
                      ? "Floating mic enabled"
                      : "Enable floating mic"}
                  </button>
                  <p className="fine-print">
                    You can enable this later in Settings. Your current keyboard
                    can stay selected.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        <footer className="setup-footer">
          {step > 0 ? (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              className="button primary"
              disabled={
                busy ||
                (step === 1 && !speechReady) ||
                (step === 2 && !editingReady)
              }
              onClick={() => setStep(step + 1)}
            >
              {step === 0 ? "Let’s set it up" : "Continue"}
              <ChevronRight size={17} />
            </button>
          ) : (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void p.finish()}
            >
              <Check size={17} />
              {p.result ? "Finish setup" : "Finish setup · test later"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
