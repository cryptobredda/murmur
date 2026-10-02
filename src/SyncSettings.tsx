import { useState, useEffect, useRef } from "react";
import { Cloud, RefreshCw, Lock, LoaderCircle } from "lucide-react";
import type { Settings } from "./types";
import * as db from "./db";
import { synchronize, syncPreferences } from "./sync.mjs";
interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<boolean>;
  revision: string;
  idle: boolean;
  refresh: () => Promise<void>;
}
export function SyncSettings({
  settings,
  update,
  revision,
  idle,
  refresh,
}: Props) {
  const [endpoint, setEndpoint] = useState(settings.syncEndpoint),
    [username, setUsername] = useState(settings.syncUsername),
    [password, setPassword] = useState(""),
    [passphrase, setPassphrase] = useState(""),
    [remember, setRemember] = useState(settings.rememberSync),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    running = useRef(false);
  useEffect(() => {
    let alive = true;
    if (settings.rememberSync)
      void db.readSecret("sync").then((value) => {
        try {
          const secret = JSON.parse(value);
          if (alive) {
            setPassword(secret.password || "");
            setPassphrase(secret.passphrase || "");
          }
        } catch {}
      });
    return () => {
      alive = false;
      controller.current?.abort();
    };
  }, []);
  async function sync(manual = true) {
    if (running.current || !idle) return;
    if (!endpoint || passphrase.length < 8) {
      if (manual)
        setError(
          "Enter your full HTTPS sync file URL and a passphrase with at least eight characters.",
        );
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("Reading and merging your encrypted backup…");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 90000);
    try {
      if (manual) {
        if (
          !(await update({
            syncEndpoint: endpoint,
            syncUsername: username,
            rememberSync: remember,
          }))
        )
          throw new Error("Could not save your sync preferences.");
        await db.saveSecret(
          "sync",
          JSON.stringify({ password, passphrase }),
          remember,
        );
      }
      const data = await db.load();
      const local = {
        app: "murmur",
        version: 1,
        transcripts: data.history,
        words: data.words,
        snippets: data.snippets,
        deletions: await db.readDeletions(),
        preferences: syncPreferences(data.settings || settings),
      };
      const result = await synchronize(
        local,
        { endpoint, username, password, passphrase },
        settings.syncScope,
        abort.signal,
      );
      await db.applySync(result);
      await refresh();
      setMessage(
        "Synchronized · " +
          new Date().toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }),
      );
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Sync canceled or timed out. Your local data is kept."
          : e instanceof Error
            ? e.message
            : "Cannot reach the server. Check HTTPS, credentials, and CORS.",
      );
      setMessage("");
    } finally {
      clearTimeout(timeout);
      running.current = false;
      setBusy(false);
      controller.current = null;
    }
  }
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    if (
      !settings.autoSync ||
      !idle ||
      !endpoint ||
      endpoint !== settings.syncEndpoint ||
      passphrase.length < 8
    )
      return;
    const timer = setTimeout(() => void syncRef.current(false), 5000);
    return () => clearTimeout(timer);
  }, [revision, settings.autoSync, idle, endpoint, passphrase]);
  return (
    <section className="settings-panel panel">
      <div className="panel-heading">
        <h2>Private device & team sync</h2>
        <Cloud size={19} />
      </div>
      <p className="section-description">
        Optional: connect a WebDAV server or HTTPS file endpoint that you
        control. Murmur encrypts the file on your device before upload. Use the
        same URL and passphrase on your other devices.
      </p>
      <div className="notice green">
        <Lock size={18} />
        <p>
          No Murmur account or subscription. Your server needs GET and PUT
          support plus CORS. API keys and recorded audio are excluded. Your
          server provider may have its own costs.
        </p>
      </div>
      <label className="field-label">
        Encrypted sync file URL
        <input
          data-no-dictate
          type="url"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://your-server/dav/murmur.enc.json"
        />
      </label>
      <div className="form-grid">
        <label className="field-label">
          Server username · optional
          <input
            data-no-dictate
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field-label">
          Server password
          <input
            data-no-dictate
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      <label className="field-label">
        Encryption passphrase
        <input
          data-no-dictate
          type="password"
          autoComplete="off"
          minLength={8}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <span>Keep this passphrase safe. Murmur cannot recover it.</span>
      </label>
      <label className="field-label">
        What to sync
        <select
          aria-label="Sync scope"
          value={settings.syncScope}
          onChange={(e) =>
            void update({ syncScope: e.target.value as Settings["syncScope"] })
          }
        >
          <option value="all">Personal history, dictionary & snippets</option>
          <option value="vocabulary">Shared dictionary & snippets only</option>
        </select>
      </label>
      <label className="check-line">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        Remember sync credentials on this device
      </label>
      <label className="check-line">
        <input
          type="checkbox"
          checked={settings.autoSync}
          onChange={(e) => void update({ autoSync: e.target.checked })}
        />
        Automatically sync saved changes while this app is open
      </label>
      <div className="tool-buttons">
        <button
          className="button primary"
          disabled={busy || !idle || !endpoint || passphrase.length < 8}
          onClick={() => void sync()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}{" "}
          {busy ? "Synchronizing…" : "Save & sync now"}
        </button>
        {busy && (
          <button
            className="button secondary"
            onClick={() => controller.current?.abort()}
          >
            Cancel
          </button>
        )}
      </div>
      {message && (
        <p className="sync-status" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
