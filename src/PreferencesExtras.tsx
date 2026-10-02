import { useState, useEffect } from "react";
import {
  Mic,
  Check,
  BookOpen,
  Download,
  Upload,
  Plus,
  Trash2,
  ArrowUpRight,
  Sparkles,
  BarChart3,
} from "lucide-react";
import type { Settings, Transcript, WritingProfile, Tone } from "./types";
import { wordCount } from "./core.mjs";
import { androidBridge } from "./native";
interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<boolean>;
  history: Transcript[];
  setup: () => void;
  shareVocabulary: () => void;
  importVocabulary: () => void;
}
export function PreferencesExtras({
  settings,
  update,
  history,
  setup,
  shareVocabulary,
  importVocabulary,
}: Props) {
  const native = androidBridge(),
    [enabled, setEnabled] = useState(false),
    [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setEnabled(native?.accessibilityEnabled?.() === true);
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("murmur-native-launch", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("murmur-native-launch", refresh);
    };
  }, [native]);
  const preference = (
    title: string,
    description: string,
    key: "correctSpeech" | "formatLists" | "autoLearn",
  ) => (
    <div className="setting-row">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          role="switch"
          aria-label={title}
          checked={settings[key]}
          onChange={(e) => void update({ [key]: e.target.checked })}
        />
        <span />
      </label>
    </div>
  );
  const profileChange = (id: string, patch: Partial<WritingProfile>) =>
    void update({
      profiles: settings.profiles.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });
  const total = history.reduce((n, t) => n + wordCount(t.text), 0),
    seconds = history.reduce((n, t) => n + t.duration, 0),
    saved = Math.max(0, Math.round(total / 40 - seconds / 60));
  const apps = new Map<string, number>();
  for (const t of history)
    apps.set(
      t.targetApp || "Murmur",
      (apps.get(t.targetApp || "Murmur") || 0) + wordCount(t.text),
    );
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6 + i);
    return {
      label: start.toLocaleDateString(undefined, { weekday: "short" }),
      words: history
        .filter((t) => t.createdAt >= +start && t.createdAt < +start + 86400000)
        .reduce((n, t) => n + wordCount(t.text), 0),
    };
  });
  const max = Math.max(1, ...days.map((d) => d.words));
  return (
    <>
      <section className="settings-panel panel">
        <div className="panel-heading">
          <h2>Ready from the first word</h2>
          <Sparkles size={19} />
        </div>
        <div className="setting-row">
          <div>
            <h3>Guided setup</h3>
            <p>
              Choose models, download them in the app, and test your microphone.
            </p>
          </div>
          <button className="button secondary" onClick={setup}>
            Run setup again
            <ArrowUpRight size={16} />
          </button>
        </div>
        {native?.openAppSettings && (
          <div className="setting-row">
            <div>
              <h3>Microphone access</h3>
              <p>
                Allow Murmur's microphone permission and turn on Android's
                Microphone access switch. Close calls or other recording apps if
                capture cannot start.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => native.openAppSettings?.()}
            >
              App permissions <ArrowUpRight size={16} />
            </button>
          </div>
        )}
        {native && (
          <div className="setting-row">
            <div>
              <h3>Floating mic across apps</h3>
              <p>
                {enabled
                  ? "Tap to start, tap again to finish, or press Cancel. Drag the mic to save its position. Keep your existing keyboard."
                  : "Enable the accessibility service to show the mic only beside editable, non-password fields. Android may require “Allow restricted settings” in App info for a downloaded app."}
              </p>
            </div>
            <button
              className={`button ${enabled ? "secondary" : "primary"}`}
              onClick={() => native.openAccessibilitySettings?.()}
            >
              {enabled ? <Check size={16} /> : <Mic size={16} />}{" "}
              {enabled ? "Enabled · manage" : "Enable floating mic"}
            </button>
          </div>
        )}
        {native && <div className="setting-row"><div><h3>Background recording</h3><p>Android shows a silent notification during recording and processing. It disappears when dictation finishes. The microphone is off between dictations.</p></div></div>}
      </section>
      <section className="settings-panel panel">
        <div className="panel-heading">
          <h2>Speak naturally</h2>
          <Mic size={19} />
        </div>
        {preference(
          "Understand spoken corrections",
          "Use your final choice when you say “Friday, actually Monday” or “4 pm, actually 3 pm”.",
          "correctSpeech",
        )}
        {preference(
          "Format numbered lists",
          "Speak “number one”, “number two”, and so on to create a readable list.",
          "formatLists",
        )}
        {preference(
          "Learn spelling corrections",
          "Learn single-word corrections made to saved dictations or recent text inserted by the floating mic. Other typing is not collected.",
          "autoLearn",
        )}
      </section>
      <section className="settings-panel panel">
        <div className="panel-heading">
          <h2>Styles for where you write</h2>
          <Sparkles size={19} />
        </div>
        <div className="setting-row">
          <div>
            <h3>Default tone</h3>
            <p>Used inside Murmur and when no app profile matches.</p>
          </div>
          <select
            aria-label="Default writing tone"
            className="setting-select"
            value={settings.tone}
            onChange={(e) => void update({ tone: e.target.value as Tone })}
          >
            <option value="neutral">Neutral</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="very-casual">Very casual</option>
          </select>
        </div>
        <p className="section-description">
          Profiles are selected by the destination Android app. AI editing
          follows tone and custom instructions; smart cleanup applies simple
          tone rules.
        </p>
        <div className="profile-list">
          {settings.profiles.map((profile) => (
            <article key={profile.id} className="writing-profile">
              <button
                className="profile-summary"
                onClick={() => setOpen(open === profile.id ? null : profile.id)}
              >
                <strong>{profile.name}</strong>
                <span>
                  {profile.tone} · {profile.format}
                </span>
                <span>{open === profile.id ? "Close" : "Edit"}</span>
              </button>
              {open === profile.id && (
                <div className="profile-fields">
                  <label className="field-label">
                    Profile name
                    <input
                      type="text"
                      data-no-dictate
                      maxLength={60}
                      value={profile.name}
                      onChange={(e) =>
                        profileChange(profile.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <label className="field-label">
                    App package names or matching words
                    <input
                      type="text"
                      data-no-dictate
                      maxLength={300}
                      value={profile.packages}
                      placeholder="com.google.android.gm, outlook"
                      onChange={(e) =>
                        profileChange(profile.id, { packages: e.target.value })
                      }
                    />
                    <span>
                      Separate matches with commas. A profile applies when a
                      destination package contains a match.
                    </span>
                  </label>
                  <div className="form-grid">
                    <label className="field-label">
                      Tone
                      <select
                        value={profile.tone}
                        onChange={(e) =>
                          profileChange(profile.id, {
                            tone: e.target.value as Tone,
                          })
                        }
                      >
                        <option value="neutral">Neutral</option>
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                        <option value="very-casual">Very casual</option>
                      </select>
                    </label>
                    <label className="field-label">
                      Format
                      <select
                        value={profile.format}
                        onChange={(e) =>
                          profileChange(profile.id, {
                            format: e.target.value as WritingProfile["format"],
                          })
                        }
                      >
                        <option value="auto">Automatic</option>
                        <option value="email">Email</option>
                        <option value="list">List</option>
                        <option value="code">Code & terminal</option>
                      </select>
                    </label>
                  </div>
                  <label className="field-label">
                    Custom AI instruction
                    <textarea
                      data-no-dictate
                      maxLength={500}
                      value={profile.instruction}
                      placeholder="Keep messages brief and friendly."
                      onChange={(e) =>
                        profileChange(profile.id, {
                          instruction: e.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="text-button danger"
                    onClick={() =>
                      void update({
                        profiles: settings.profiles.filter(
                          (p) => p.id !== profile.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                    Remove profile
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        <button
          className="button secondary"
          onClick={() => {
            const id = crypto.randomUUID();
            void update({
              profiles: [
                ...settings.profiles,
                {
                  id,
                  name: "New app style",
                  packages: "",
                  tone: "neutral",
                  format: "auto",
                  instruction: "",
                },
              ],
            });
            setOpen(id);
          }}
        >
          <Plus size={16} />
          Add app style
        </button>
      </section>
      <section className="settings-panel panel">
        <div className="panel-heading">
          <h2>Share your vocabulary</h2>
          <BookOpen size={19} />
        </div>
        <p className="section-description">
          Share names, terminology, and snippets with a teammate or another
          device. Vocabulary exports contain no dictation history or API keys.
        </p>
        <div className="tool-buttons">
          <button className="button secondary" onClick={shareVocabulary}>
            <Download size={16} />
            Export vocabulary
          </button>
          <button className="button secondary" onClick={importVocabulary}>
            <Upload size={16} />
            Import vocabulary
          </button>
        </div>
      </section>
      <section className="settings-panel panel usage-panel">
        <div className="panel-heading">
          <h2>Your dictation activity</h2>
          <BarChart3 size={19} />
        </div>
        <div className="usage-stats">
          <div>
            <strong>{total.toLocaleString()}</strong>
            <span>words</span>
          </div>
          <div>
            <strong>{history.length}</strong>
            <span>dictations & notes</span>
          </div>
          <div>
            <strong>{Math.round(seconds / 60)}</strong>
            <span>minutes dictating</span>
          </div>
          <div>
            <strong>{saved}</strong>
            <span>estimated minutes saved</span>
          </div>
        </div>
        <p className="fine-print">
          Time saved estimates typing at 40 words per minute and subtracts
          recording time.
        </p>
        <div
          className="usage-chart"
          aria-label="Words dictated over the last seven days"
        >
          {days.map((day, i) => (
            <div key={i}>
              <span>{day.words}</span>
              <i
                style={{ height: Math.max(3, (day.words / max) * 80) + "px" }}
              />
              <small>{day.label}</small>
            </div>
          ))}
        </div>
        {apps.size > 0 && (
          <div className="usage-apps">
            {[...apps]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([app, count]) => (
                <div key={app}>
                  <span>{app}</span>
                  <strong>{count.toLocaleString()} words</strong>
                </div>
              ))}
          </div>
        )}
      </section>
    </>
  );
}
