import { useState } from "react";
import {
  Download,
  Check,
  LoaderCircle,
  Trash2,
  Cloud,
  ShieldCheck,
} from "lucide-react";
import {
  editingModels,
  editingModelOptions,
  type Settings,
  type EditingProvider,
} from "./types";
import { DeviceGuidance } from "./DeviceGuidance";
import type { EditingDownload } from "./useEditingModel";
interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<boolean>;
  download: EditingDownload;
  saveKey: (key: string, remember: boolean) => Promise<void>;
  initialKey: string;
  compact?: boolean;
}
export function EditingSettings({
  settings,
  update,
  download,
  saveKey,
  initialKey,
  compact = false,
}: Props) {
  const [key, setKey] = useState(initialKey),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const local = settings.editingProvider === "local",
    cloud = !["basic", "local"].includes(settings.editingProvider);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveKey(key.trim(), settings.rememberEditingKey);
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the editing key.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`editing-settings ${compact ? "compact-setup" : ""}`}>
      <div className="panel-heading">
        <h2>Editing & rewriting</h2>
        <ShieldCheck size={19} />
      </div>
      <p className="section-description">
        Speech recognition finds your words. The editing engine cleans them up,
        follows writing instructions, and adapts your tone.
      </p>
      <div className="choice-grid" role="group" aria-label="Editing engine">
        {(
          [
            ["basic", "Smart cleanup", "Free · no extra download"],
            ["local", "On-device AI", "Free · downloaded inside the app"],
            ["openai", "Cloud AI", "Optional · your provider key"],
          ] as const
        ).map(([provider, label, detail]) => (
          <button
            key={provider}
            disabled={!!download.loading}
            className={`setup-choice ${settings.editingProvider === provider || (provider === "openai" && cloud) ? "selected" : ""}`}
            onClick={() => void update({ editingProvider: provider })}
          >
            <strong>{label}</strong>
            <span>{detail}</span>
          </button>
        ))}
      </div>
      {settings.editingProvider === "basic" && (
        <div className="notice green">
          <Check size={19} />
          <p>
            Includes explicit spoken corrections, fillers, punctuation commands,
            numbered lists, vocabulary, and snippets. Choose AI for free-form
            rewriting and translation.
          </p>
        </div>
      )}
      {local && (
        <>
          <div className="setup-models">
          {editingModelOptions().map((model) => (
              <article
                key={model}
                className={`setup-model ${settings.editingModel === model ? "selected" : ""}`}
              >
                <label>
                  <input
                    type="radio"
                    name="editing-model"
                    checked={settings.editingModel === model}
                    disabled={!!download.loading}
                    onChange={() => void update({ editingModel: model })}
                  />
                  <div>
                    <strong>{editingModels[model].name}</strong>
                    <span>
                      {editingModels[model].size} ·{" "}
                      {editingModels[model].languages}
                    </span>
                    <p>{editingModels[model].description}</p>
                  </div>
                </label>
                {download.cached.includes(model) && !compact && (
                  <button
                    className="icon-button delete"
                    aria-label={`Remove ${editingModels[model].name}`}
                    disabled={!!download.loading}
                    onClick={() => void download.remove(model)}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </article>
            ))}
          </div>
          {download.loading ? (
            <div className="download-status" aria-live="polite">
              <div className="progress-track">
                <span style={{ width: download.progress + "%" }} />
              </div>
              <p>
                <LoaderCircle size={16} className="spin" />
                {download.detail}
                <strong>{download.progress}%</strong>
              </p>
              <button className="button secondary" onClick={download.cancel}>
                Cancel download
              </button>
            </div>
          ) : (
            <button
              className="button primary full-button"
              disabled={download.ready === settings.editingModel || !window.MurmurAndroid?.editNativeWriting}
              onClick={() => void download.prepare(settings.editingModel)}
            >
              {download.ready === settings.editingModel ? (
                <Check size={17} />
              ) : (
                <Download size={17} />
              )}{" "}
              {download.ready === settings.editingModel
                ? "Editing model ready"
                : download.cached.includes(settings.editingModel)
                  ? "Load saved editing model"
                  : `Download ${editingModels[settings.editingModel].name}`}
            </button>
          )}
          {download.error && (
            <div role="alert" className="notice error">
              <p>
                {download.error} Try again; complete downloaded files are
                reused.
              </p>
            </div>
          )}
          <DeviceGuidance withWriting />
          <p className="fine-print">
            Local AI quality and speed depend on the model and your phone. All
            model files stay inside the app; no separate installer is needed.
          </p>
        </>
      )}
      {cloud && (
        <>
          <div
            className="cloud-options"
            role="group"
            aria-label="Editing cloud provider"
          >
            {(["openai", "groq", "custom"] as EditingProvider[]).map(
              (provider) => (
                <button
                  key={provider}
                  className={
                    settings.editingProvider === provider ? "selected" : ""
                  }
                  onClick={() => {
                    setSaved(false);
                    void update({
                      editingProvider: provider,
                      editingCloudModel:
                        provider === "groq"
                          ? "llama-3.3-70b-versatile"
                          : provider === "openai"
                            ? "gpt-4.1-mini"
                            : settings.editingCloudModel,
                    });
                  }}
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
          <div className="notice warm">
            <Cloud size={18} />
            <p>
              Only text goes to this editing provider. Speech and editing
              providers are configured separately. Your provider may charge for
              usage.
            </p>
          </div>
          {settings.editingProvider === "custom" && (
            <label className="field-label">
              Chat completions endpoint
              <input
                data-no-dictate
                type="url"
                value={settings.editingEndpoint}
                placeholder="https://your-server/v1/chat/completions"
                onChange={(e) =>
                  void update({ editingEndpoint: e.target.value })
                }
              />
            </label>
          )}
          <label className="field-label">
            Editing model
            <input
              data-no-dictate
              type="text"
              value={settings.editingCloudModel}
              onChange={(e) =>
                void update({ editingCloudModel: e.target.value })
              }
            />
          </label>
          <label className="field-label">
            Editing API key
            <input
              data-no-dictate
              autoComplete="off"
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setSaved(false);
              }}
              placeholder={
                settings.editingProvider === "custom"
                  ? "Optional for your server"
                  : "Enter your provider key"
              }
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={settings.rememberEditingKey}
              onChange={(e) =>
                void update({ rememberEditingKey: e.target.checked })
              }
            />
            Remember editing key on this device
          </label>
          <button
            className="button primary"
            disabled={
              busy || (!key.trim() && settings.editingProvider !== "custom")
            }
            onClick={() => void save()}
          >
            {saved ? <Check size={16} /> : null}
            {busy
              ? "Saving…"
              : saved
                ? "Editing key saved"
                : "Save editing key"}
          </button>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
