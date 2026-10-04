import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Mic,
  History,
  BookOpen,
  SlidersHorizontal,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Check,
  Copy,
  Download,
  Plus,
  Search,
  X,
  Star,
  Trash2,
  MoreHorizontal,
  Square,
  LoaderCircle,
  Headphones,
  Globe,
  Cloud,
  HardDrive,
  HelpCircle,
  Menu,
  AudioLines,
  FileText,
  Clock,
  CheckCheck,
  Upload,
  Lock,
  Volume2,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Pencil,
  Command,
  AlertCircle,
} from "lucide-react";
import {
  defaults,
  models,
  languageOptions,
  normalizeSettings,
  type View,
  type Settings,
  type Transcript,
  type Word,
  type Snippet,
  type LocalModel,
  type Provider,
  type Style,
  editingModels,
  speechModelOptions,
  supportsSpeechLanguage,
} from "./types";
import * as db from "./db";
import {
  formatText,
  wordCount,
  validateBackup,
  validateEndpoint,
  learnCorrection,
  chooseProfile,
  codeFormat,
  applyTone,
  validEditedText,
} from "./core.mjs";
import { androidBridge, androidLaunch } from "./native";
import {
  Recorder,
  NativeRecorder,
  loadModel,
  localTranscribe,
  cloudTranscribe,
  cancelLocal,
  type Progress,
  isModelCached,
} from "./engine";

import { SyncSettings } from "./SyncSettings";
import { Onboarding } from "./Onboarding";
import { EditingSettings } from "./EditingSettings";
import { PreferencesExtras } from "./PreferencesExtras";
import { useEditingModel } from "./useEditingModel";
import { editWriting, cancelEditing, automaticEditingBudget } from "./writing";
import { retrySavedAudio } from "./recovery.mjs";
import { SavedAudio } from "./SavedAudio";
import { DeviceGuidance } from "./DeviceGuidance";
import { ModelTrials } from "./ModelTrials";
import { VoiceSettings } from "./VoiceSettings";
import { ReadAloud } from "./ReadAloud";

type Phase = "idle" | "starting" | "recording" | "transcribing" | "editing";
const navigation = [
  { id: "dictate", label: "Dictate", icon: Mic },
  { id: "history", label: "History", icon: History },
  { id: "dictionary", label: "Dictionary", icon: BookOpen },
  { id: "models", label: "Models & providers", icon: SlidersHorizontal },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;
const providerNames: Record<Provider, string> = {
  local: "On-device",
  openai: "OpenAI",
  groq: "Groq",
  custom: "Custom endpoint",
};
const dateLabel = (n: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(n);
const timeLabel = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const id = () => crypto.randomUUID();
const safeError = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
function downloadFile(
  name: string,
  content: string,
  type = "application/json",
) {
  const native = androidBridge();
  if (native) {
    try {
      return native.exportText(name, content, type);
    } catch {
      return false;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return true;
}
function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        murmur<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span />
    </label>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea,select,a[href],[tabindex="0"]',
        );
        if (!items?.length) {
          e.preventDefault();
          return;
        }
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      if (prior?.isConnected) prior.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function App() {
  const native = androidBridge();
  const [nativeLaunch, setNativeLaunch] = useState(androidLaunch);
  const [appActive, setAppActive] = useState(true);
  const [backgroundBusy, setBackgroundBusy] = useState(() => native?.backgroundBusy?.() === true);
  const [actionError, setActionError] = useState("");
  const [retryRecord, setRetryRecord] = useState<Transcript | null>(null);
  const [overlayPausedUntil, setOverlayPausedUntil] = useState(0);
  const processingRecord = useRef<Transcript | null>(null);
  const recordingDestination = useRef("");
  const initialView = () =>
    navigation.some((n) => n.id === location.hash.slice(1))
      ? (location.hash.slice(1) as View)
      : "dictate";
  const [view, setView] = useState<View>(initialView);
  const [settings, setSettings] = useState<Settings>(defaults);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [history, setHistory] = useState<Transcript[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [draft, setDraft] = useState("");
  const [lastRecord, setLastRecord] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [auxBusy,setAuxBusy] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [readyModel, setReadyModel] = useState<LocalModel | null>(null);
  const [loadingModel, setLoadingModel] = useState<LocalModel | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelFile, setModelFile] = useState("Preparing your model…");
  const [cachedModels, setCachedModels] = useState<LocalModel[]>([]);
  const [modelError, setModelError] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const showSetup = loaded && (!settings.onboardingComplete || setupOpen);
  const setupRef = useRef(showSetup);
  setupRef.current = showSetup;
  const editing = useEditingModel();
  const [editingKey, setEditingKey] = useState("");
  const [editingKeyProvider, setEditingKeyProvider] = useState(
    settings.editingProvider,
  );
  const [speechKeyProvider, setSpeechKeyProvider] = useState<Provider>("local");
  const [recordingMode, setRecordingMode] = useState<"dictate" | "command">(
    "dictate",
  );
  const modeRef = useRef<"dictate" | "command">("dictate");
  const commandOriginal = useRef("");
  const attemptedLoad = useRef("");
  const [modelDialog, setModelDialog] = useState(false);
  const [help, setHelp] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [apiKey, setApiKey] = useState("");
  const [revealKey, setRevealKey] = useState(false);
  const [focused, setFocused] = useState<HTMLElement | null>(null);
  const targetRef = useRef<{
    element: HTMLInputElement | HTMLTextAreaElement;
    start: number;
    end: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "starred">("all");
  const [dictionaryTab, setDictionaryTab] = useState<"words" | "snippets">(
    "words",
  );
  const [vocabDialog, setVocabDialog] = useState<{
    kind: "words" | "snippets";
    existing?: Word | Snippet;
  } | null>(null);
  const [vocabFrom, setVocabFrom] = useState("");
  const [vocabTo, setVocabTo] = useState("");
  const [editRecord, setEditRecord] = useState<Transcript | null>(null);
  const [editText, setEditText] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cloudForm, setCloudForm] = useState({
    endpoint: "",
    model: "whisper-1",
    key: "",
    remember: false,
  });
  const pendingModelTarget = useRef<typeof targetRef.current>(null);
  const recordTargetRef = useRef<typeof targetRef.current>(null);
  const modelGeneration = useRef(0);
  const recorder = useRef<Recorder | NativeRecorder | null>(null);
  const session = useRef(0);
  const startTime = useRef(0);
  const cloudAbort = useRef<AbortController | null>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const say = (text: string, error = false) => {
    if (error) { setActionError(text); return; }
    if (text !== "Copied to clipboard") return;
    clearTimeout(toastTimer.current);
    setToast({ text });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  const navigate = (next: View) => {
    if (phaseRef.current !== "idle") {
      say("Finish or cancel your recording first.");
      return;
    }
    setActionError("");
    setView(next);
    location.hash = next;
    setFocused(null);
    targetRef.current = null;
    window.scrollTo({ top: 0 });
  };
  async function updateSettings(patch: Partial<Settings>) {
    const before = settingsRef.current;
    const next = normalizeSettings({
      ...before,
      ...patch,
      preferencesUpdatedAt: Object.keys(patch).some((key) =>
        [
          "language",
          "style",
          "tone",
          "profiles",
          "removeFillers",
          "voiceCommands",
          "correctSpeech",
          "formatLists",
          "autoLearn",
        ].includes(key),
      )
        ? Date.now()
        : before.preferencesUpdatedAt,
    });
    settingsRef.current = next;
    setSettings(next);
    try {
      await db.put("settings", { id: "preferences", value: next });
      return true;
    } catch (e) {
      if (settingsRef.current === next) {
        settingsRef.current = before;
        setSettings(before);
      }
      say(safeError(e), true);
      setStorageError(safeError(e));
      return false;
    }
  }
  useEffect(() => {
    let active = true;
    db.load()
      .then(async (data) => {
        if (!active) return;
        setHistory(data.history);
        setWords(data.words);
        setSnippets(data.snippets);
        const preferences = normalizeSettings(data.settings);
        setSettings(preferences);
        settingsRef.current = preferences;
        const key = preferences.rememberKey || native ? await db.readSecret("speech", db.credentialScope(preferences.provider, preferences.cloudEndpoint)) : "";
        if (!active) return;
        setApiKey(key);
        setSpeechKeyProvider(preferences.provider);
        const editingSecret = preferences.rememberEditingKey || native
          ? await db.readSecret("editing", db.credentialScope(preferences.editingProvider, preferences.editingEndpoint))
          : "";
        if (!active) return;
        setEditingKey(editingSecret);
        setEditingKeyProvider(preferences.editingProvider);
        setCloudForm({
          endpoint: preferences.cloudEndpoint,
          model: preferences.cloudModel,
          key,
          remember: preferences.rememberKey,
        });
      })
      .catch((e) => {
        if (active) setStorageError(safeError(e));
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    const hash = () => {
      if (phaseRef.current === "idle") setView(initialView());
    };
    const before = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("beforeinstallprompt", before);
    void Promise.all(speechModelOptions().map(async model => (await isModelCached(model)) ? model : null))
      .then(items => {if(active)setCachedModels(items.filter((model): model is LocalModel => model !== null));}).catch(()=>{});
    return () => {
      active = false;
      session.current++;
      void recorder.current?.cleanup();
      cloudAbort.current?.abort();
      cancelLocal();
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("beforeinstallprompt", before);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const eligible = (
      element: Element | null,
    ): element is HTMLInputElement | HTMLTextAreaElement =>
      !!element?.matches(
        'textarea:not([data-no-dictate]),input[type="text"]:not([data-no-dictate])',
      ) &&
      !(element as HTMLInputElement).disabled &&
      !(element as HTMLInputElement).readOnly;
    const focus = (e: FocusEvent) => {
      const element = e.target as Element;
      if (eligible(element)) {
        setFocused(element);
        targetRef.current = {
          element,
          start: element.selectionStart ?? element.value.length,
          end: element.selectionEnd ?? element.value.length,
        };
      } else if (phaseRef.current === "idle") {
        setFocused(null);
        targetRef.current = null;
      }
    };
    const selection = () => {
      const element = document.activeElement;
      if (eligible(element))
        targetRef.current = {
          element,
          start: element.selectionStart ?? element.value.length,
          end: element.selectionEnd ?? element.value.length,
        };
    };
    const blur = () => {
      setTimeout(() => {
        if (phaseRef.current === "idle" && !eligible(document.activeElement)) {
          setFocused(null);
          targetRef.current = null;
        }
      }, 0);
    };
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    document.addEventListener("selectionchange", selection);
    return () => {
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", blur);
      document.removeEventListener("selectionchange", selection);
    };
  }, []);
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      const elapsed = Math.floor(
        (performance.now() - startTime.current) / 1000,
      );
      setSeconds(elapsed);
      if (elapsed >= 1800) void stopRef.current();
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (loaded) {native?.configureSpeech?.(settings.provider,settings.localModel);native?.configureSpeechLanguage?.(settings.language);}
  },[loaded,settings.provider,settings.localModel,settings.language]);
  useEffect(() => {
    if (phase === "idle" || native || !navigator.wakeLock) return;
    let lock: WakeLockSentinel | undefined,disposed=false;
    const acquire=async()=>{
      if(document.visibilityState!=="visible"||disposed)return;
      try {const next=await navigator.wakeLock.request("screen");if(disposed)void next.release();else lock=next;}catch{}
    };
    void acquire();document.addEventListener("visibilitychange",acquire);
    return()=>{disposed=true;void lock?.release();document.removeEventListener("visibilitychange",acquire);};
  },[phase]);
  const actionRef = useRef<() => void>(() => {});
  actionRef.current = () => {
    if (phase === "recording") void stopRecording();
    else if (phase === "idle") void beginRecording(recordingMode);
  };
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (
        !setupRef.current &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.code === "Space"
      ) {
        e.preventDefault();
        actionRef.current();
      }
      if (e.key === "Escape" && phaseRef.current !== "idle") {
        cancelRecording();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    const vv = window.visualViewport;
    const sync = () =>
      document.documentElement.style.setProperty(
        "--keyboard-offset",
        `${Math.max(0, window.innerHeight - (vv?.height || window.innerHeight) - (vv?.offsetTop || 0))}px`,
      );
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      setAppActive(true);
      const processing = native?.backgroundBusy?.() === true;
      setBackgroundBusy(processing);
      if (phaseRef.current === "idle") void db.load().then((data) => {
        setHistory(data.history); setWords(data.words); setSnippets(data.snippets);
      }).catch((error) => setStorageError(safeError(error)));
      const next = androidLaunch();
      setNativeLaunch(next);

    };
    const background = () => setAppActive(false);
    window.addEventListener("murmur-native-launch", refresh);
    window.addEventListener("murmur-native-background", background);
    return () => {
      window.removeEventListener("murmur-native-launch", refresh);
      window.removeEventListener("murmur-native-background", background);
    };
  }, []);
  useEffect(() => {
    if (!native || appActive || phase !== "idle" || loadingModel || editing.loading) return;
    modelGeneration.current++;
    cancelLocal(); setReadyModel(null); attemptedLoad.current = "";
    editing.cancel();
    native.resumeBackgroundEngine?.();
  }, [appActive, phase, loadingModel, editing.loading]);

  useEffect(() => {
    if (loaded)
      native?.configureOverlay?.(settings.floatingMic, settings.autoLearn);
  }, [loaded, settings.floatingMic, settings.autoLearn]);
  useEffect(()=>{if(loaded)native?.configureOverlayAppearance?.(settings.overlayOpacity);},[loaded,settings.overlayOpacity]);
  useEffect(()=>{
    if(!native?.overlayStatus)return;
    const refresh=()=>{try{const deadline=Number(JSON.parse(native.overlayStatus!()).pausedUntil)||0;setOverlayPausedUntil(deadline>Date.now()&&deadline-Date.now()<=600000?deadline:0);}catch{}};
    refresh();const timer=setInterval(refresh,5000);return()=>clearInterval(timer);
  },[native]);
  useEffect(() => {
    if (
      !loaded || !appActive || backgroundBusy || auxBusy ||
      settings.provider !== "local" ||
      readyModel === settings.localModel ||
      loadingModel ||
      !cachedModels.includes(settings.localModel) ||
      attemptedLoad.current === settings.localModel
    )
      return;
    attemptedLoad.current = settings.localModel;
    void prepareModel(settings.localModel);
  }, [
    loaded, appActive, backgroundBusy, auxBusy,
    settings.provider,
    settings.localModel,
    cachedModels,
    readyModel,
    loadingModel,
  ]);
  useEffect(() => {
    if (!loaded) return;
    const collect = async () => {
      try {
        const learned = JSON.parse(native?.takeLearnedWords?.() || "[]");
        if (!settingsRef.current.autoLearn || !Array.isArray(learned)) return;
        for (const term of learned) {
          if (
            typeof term.spoken !== "string" ||
            typeof term.replacement !== "string" ||
            term.spoken.length > 150 ||
            term.replacement.length > 200
          )
            continue;
          const word: Word = {
            id:
              wordsRef.current.find(
                (x) => x.spoken.toLowerCase() === term.spoken.toLowerCase(),
              )?.id || id(),
            spoken: term.spoken,
            replacement: term.replacement,
            updatedAt: Date.now(),
          };
          await db.put("words", word);
          setWords((old) => [
            ...old.filter(
              (x) => x.spoken.toLowerCase() !== word.spoken.toLowerCase(),
            ),
            word,
          ]);
        }
      } catch {}
    };
    void collect();
    window.addEventListener("focus", collect);
    window.addEventListener("murmur-native-launch", collect);
    return () => {
      window.removeEventListener("focus", collect);
      window.removeEventListener("murmur-native-launch", collect);
    };
  }, [loaded]);
  async function learnEdit(before: string, after: string) {
    if (!settingsRef.current.autoLearn) return;
    const term = learnCorrection(before, after);
    if (!term) return;
    const old = words.find(
      (w) => w.spoken.toLowerCase() === term.spoken.toLowerCase(),
    );
    const word: Word = { ...term, id: old?.id || id(), updatedAt: Date.now() };
    await db.put("words", word);
    setWords((list) => [...list.filter((w) => w.id !== word.id), word]);
  }
  async function finishSetup() {
    if (await updateSettings({ onboardingComplete: true })) {
      setSetupOpen(false);
      say("You’re ready. Models and downloads can be managed inside Murmur.");
    }
  }
  async function saveSpeechProvider(
    provider: Provider,
    endpoint: string,
    model: string,
    key: string,
    remember: boolean,
  ) {
    if (provider === "custom") {
      validateEndpoint(endpoint);
      if (!model.trim())
        throw new Error("Enter your transcription model name.");
    } else if (!key.trim()) throw new Error("Enter your speech provider key.");
    await db.saveSecret("speech", key.trim(), remember, db.credentialScope(provider, endpoint));
    if (
      !(await updateSettings({
        provider,
        cloudEndpoint: endpoint.trim(),
        cloudModel: model.trim(),
        rememberKey: remember,
      }))
    )
      throw new Error("Could not save provider settings.");
    setApiKey(key.trim());
    setSpeechKeyProvider(provider);
    setCloudForm({ endpoint, model, key, remember });
  }
  async function saveEditingKey(key: string, remember: boolean) {
    await db.saveSecret("editing", key.trim(), remember, db.credentialScope(settingsRef.current.editingProvider, settingsRef.current.editingEndpoint));
    if (!(await updateSettings({ rememberEditingKey: remember })))
      throw new Error("Could not save editing preferences.");
    setEditingKey(key.trim());
    setEditingKeyProvider(settingsRef.current.editingProvider);
  }
  async function removeModel(model: LocalModel) {
    try {
      if(!native?.removeNativeSpeech?.(model))throw new Error("Finish the active dictation before removing its model.");
      if (readyModel === model) {
        cancelLocal();
        setReadyModel(null);
      }
      setCachedModels((old) => old.filter((x) => x !== model));
      attemptedLoad.current = "";
      say("Downloaded model removed. Your history is kept.");
    } catch (e) {
      say(safeError(e), true);
    }
  }
  async function prepareModel(model: LocalModel) {
    if (loadingModel || auxBusy) return;
    const generation = ++modelGeneration.current;
    setLoadingModel(model);
    setModelProgress(0);
    setModelError("");
    setModelFile("Connecting to the model library…");
    setReadyModel(null);
    try {
      await loadModel(model, (p: Progress) => {
        if (p.status === "progress" && p.file && p.total) {
          setModelProgress(Math.min(99,Math.round((p.loaded || 0)/p.total*100)));
          setModelFile(`${((p.loaded || 0)/1e6).toFixed(1)} MB of ${(p.total/1e6).toFixed(1)} MB`);
        } else if (p.status === "done") {
          setModelFile("Getting speech recognition ready on your device…");
        }
      });
      if (generation !== modelGeneration.current) return;
      setReadyModel(model);
      setModelProgress(100);
      setCachedModels((old) => [...new Set([...old, model])]);
      say(`${models[model].name} is ready. Your voice stays on this device.`);
      if (navigator.storage?.persist)
        void navigator.storage.persist().catch(() => {});
    } catch (e) {
      if (generation === modelGeneration.current) {
        setModelError(safeError(e));
        say(safeError(e), true);
      }
    } finally {
      if (generation === modelGeneration.current) setLoadingModel(null);
    }
  }
  function cancelDownload() {
    pendingModelTarget.current = null;
    modelGeneration.current++;
    cancelLocal();
    setLoadingModel(null);
    setReadyModel(null);
    setModelDialog(false);
    say("Model download cancelled.");
  }
  async function copy(text: string, automatic = false) {
    if (!text.trim()) return false;
    try {
      const bridge = androidBridge();
      if (bridge) {
        if (!bridge.copyText(text)) throw new Error("Clipboard unavailable");
        if (!automatic) say("Copied to clipboard");
        return true;
      }
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (!automatic) say("Copied to clipboard");
      return true;
    } catch {
      if (!automatic)
        say(
          "Clipboard access is unavailable. Select the text and copy it manually.",
          true,
        );
      return false;
    }
  }
  async function beginRecording(
    requestedMode: "dictate" | "command" = "dictate",
  ) {
    if (!loaded || phaseRef.current !== "idle" || loadingModel || auxBusy || backgroundBusy || native?.backgroundBusy?.()) return;
    setActionError("");
    setRetryRecord(null);
    processingRecord.current=null;
    const config = settingsRef.current;
    if (config.provider === "local" && !supportsSpeechLanguage(config.localModel,config.language)) {say("This speech model does not support the selected language. Choose another model.",true);return;}
    const mode = requestedMode;
    const selection = targetRef.current;
    commandOriginal.current =
      (selection && selection.end > selection.start
        ? selection.element.value.slice(selection.start, selection.end)
        : draft);
    if (
      mode === "command" &&
      (!commandOriginal.current.trim() || config.editingProvider === "basic")
    ) {
      say(
        !commandOriginal.current.trim()
          ? "Select or add the text you want to rewrite first."
          : "Choose an AI editing model in Models & providers for voice commands.",
        true,
      );
      return;
    }
    if (
      mode === "command" && config.editingProvider === "local" &&
      editing.ready !== config.editingModel
    ) {
      if (editing.cached.includes(config.editingModel)) {
        if (!(await editing.prepare(config.editingModel))) return;
      } else {
        navigate("models");
        say("Download your editing model inside Murmur first.", true);
        return;
      }
    }
    if (config.provider === "local" && readyModel !== config.localModel) {
      pendingModelTarget.current = targetRef.current
        ? { ...targetRef.current }
        : null;
      setModelDialog(true);
      return;
    }
    if (config.provider !== "local") {
      if (
        config.provider !== "custom" &&
        (!apiKey || speechKeyProvider !== config.provider)
      ) {
        navigate("models");
        say("Add your provider’s API key to use cloud dictation.", true);
        return;
      }
      if (config.provider === "custom") {
        try {
          validateEndpoint(config.cloudEndpoint);
        } catch (e) {
          navigate("models");
          say(safeError(e), true);
          return;
        }
      }
    }
    modeRef.current = mode;
    setRecordingMode(mode);
    recordingDestination.current = "";
    recordTargetRef.current = targetRef.current ? { ...targetRef.current } : pendingModelTarget.current;
    if (
      mode === "command" &&
      !(selection && selection.end > selection.start) &&
      textArea.current
    ) {
      recordTargetRef.current = {
        element: textArea.current,
        start: 0,
        end: draft.length,
      };
    }
    pendingModelTarget.current = null;
    const token = ++session.current;
    setPhase("starting");
    phaseRef.current = "starting";
    setSeconds(0);
    setLevel(0);
    const nextRecorder = native?.startNativeRecording
      ? new NativeRecorder()
      : new Recorder();
    recorder.current = nextRecorder;
    try {
      await nextRecorder.start(setLevel);
      if (session.current !== token) {
        await nextRecorder.cleanup();
        return;
      }
      startTime.current =
        performance.now() -
        (nextRecorder instanceof NativeRecorder
          ? nextRecorder.elapsed * 1000
          : 0);
      setPhase("recording");
      phaseRef.current = "recording";
    } catch (e) {
      if (session.current === token) {
        setPhase("idle");
        phaseRef.current = "idle";
        say(safeError(e), true);
      }
      await nextRecorder.cleanup();
    }
  }
  async function stopRecording(recovery?: Transcript) {
    if (recovery ? phaseRef.current !== "idle" || auxBusy || backgroundBusy || native?.backgroundBusy?.() : phaseRef.current !== "recording") return;
    setActionError("");
    setPhase("transcribing");
    phaseRef.current = "transcribing";
    const token = recovery ? ++session.current : session.current;
    const config = { ...settingsRef.current };
    const nativeAsr = config.provider === "local" && models[config.localModel].engine === "native";
    const processingStarted = performance.now();
    let pending: Transcript | undefined = recovery ? {...recovery,status:"processing",error:""} : undefined;
    const controller = new AbortController();
    cloudAbort.current = controller;
    const processingDeadline=setTimeout(()=>{
      if(session.current!==token)return;
      controller.abort();cloudAbort.current?.abort();cancelLocal();cancelEditing();
    },165000);
    try {
      if (recovery) {
        if (!recovery.audioId) throw new Error("This recording has no saved audio.");
        if(recovery.mode === "command" && config.editingProvider === "basic") throw new Error("Choose an AI editing model to retry this voice command.");
        modeRef.current = recovery.mode || "dictate";
        commandOriginal.current = recovery.originalText || "";
        recordTargetRef.current = null;
        recordingDestination.current = recovery.targetApp || "";
        if (native?.beginSavedProcessing && !native.beginSavedProcessing(recovery.audioId)) throw new Error("Could not start processing this saved recording.");
        if (config.provider === "local" && readyModel !== config.localModel) {await loadModel(config.localModel,()=>{},true);setReadyModel(config.localModel);}
      }
      const currentRecorder = recorder.current;
      const audio = recovery ? (nativeAsr ? new Float32Array(0) : await db.readAudio(recovery.audioId!))
        : currentRecorder instanceof NativeRecorder ? await currentRecorder.stop(!nativeAsr) : await currentRecorder!.stop();
      const audioId = recovery?.audioId || (currentRecorder instanceof NativeRecorder ? currentRecorder.audioId : "") || id();
      const nativeInfo = db.nativeAudioInfo(audioId);
      const duration = Number(nativeInfo.bytes) > 0 ? Number(nativeInfo.bytes) / (Number(nativeInfo.sampleRate || 16000) * 2) : recovery?.duration || audio.length / 16000;
      pending = {...(pending || {}),id:recovery?.id || audioId,audioId,text:recovery?.text || "",raw:recovery?.raw || "",createdAt:recovery?.createdAt || Date.now(),updatedAt:Date.now(),duration,
        source:config.provider,model:config.provider === "local" ? models[config.localModel].name : config.cloudModel,style:config.style,starred:recovery?.starred || false,
        status:"processing",error:"",mode:modeRef.current,originalText:modeRef.current === "command" ? commandOriginal.current : undefined,targetApp:recordingDestination.current || "Murmur"};
      processingRecord.current=pending;
      if (recovery) await db.saveTranscript(pending); else await db.saveRecording(audio,pending);
      setHistory(old=>[pending!,...old.filter(record=>record.id!==pending!.id)]);
      if (session.current !== token) return;
      setLevel(0);
      let energy = 0;
      for (const sample of audio) energy += sample * sample;
      if (nativeAsr ? duration <= 0 : !audio.length || Math.sqrt(energy / audio.length) < 0.0015)
        throw new Error(
          native?.startNativeRecording
            ? "No speech was heard. Check Android’s Microphone access switch, close other recording apps, and try again."
            : "No speech was heard. Check your microphone and try again.",
        );
      const raw = await retrySavedAudio((attemptSignal: AbortSignal, attempt: number) => config.provider === "local"
        ? localTranscribe(audio,config.language,pending!.audioId,!!recovery || attempt > 1,attemptSignal)
        : cloudTranscribe(audio,config,apiKey,attemptSignal), {
        signal:controller.signal,
        onAttempt:async (attempt: number)=>{if(session.current!==token)return;pending={...pending!,attempts:attempt,updatedAt:Date.now()};processingRecord.current=pending;await db.saveTranscript(pending);},
        reset:async()=>{if(config.provider==="local" && session.current===token){cancelLocal();await loadModel(config.localModel,()=>{},true);}},
      });
      if (session.current !== token) return;
      const destination = recordingDestination.current;
      const profile = chooseProfile(config.profiles, destination);
      const formatConfig = {
        ...config,
        tone: profile?.tone || config.tone,
        codeMode: profile?.format === "code",
      };
      let text = formatText(
        profile?.format === "code" ? codeFormat(raw) : raw,
        formatConfig,
        words,
        snippets,
      );
      const requestedEditingModel=config.editingProvider==="local"?editingModels[config.editingModel].name:config.editingProvider==="basic"?"Smart cleanup":config.editingCloudModel;
      let appliedEditingModel=config.style==="verbatim"?"Verbatim":"Smart cleanup";
      if (
        config.editingProvider !== "basic" &&
        (config.style !== "verbatim" || modeRef.current === "command")
      ) {
        setPhase("editing");
        phaseRef.current = "editing";
        const controller = new AbortController();
        cloudAbort.current = controller;
        const timeout = setTimeout(() => {
          controller.abort();
          if (config.editingProvider === "local") {
            cancelEditing();
            editing.cancel();
          }
        }, Math.max(1000,Math.min(modeRef.current === "command" ? 45000 : automaticEditingBudget(config),155000-(performance.now()-processingStarted))));
        try {
          if (config.editingProvider === "local" && editing.ready !== config.editingModel) {
            if (!editing.cached.includes(config.editingModel) || !(await editing.prepare(config.editingModel)))
              throw new Error("Editing model unavailable.");
          }
          const candidate = await editWriting(
            text,
            config,
            editingKeyProvider === config.editingProvider ? editingKey : "",
            profile,
            controller.signal,
            modeRef.current === "command" ? raw : "",
            commandOriginal.current,
          );
          const protectedTerms = [
            ...words.map((w) => w.replacement),
            ...snippets.map((s) => s.text),
          ];
          if (
            modeRef.current !== "command" &&
            !validEditedText(text, candidate, protectedTerms)
          )
            throw new Error(
              "AI editing changed a name, number, or snippet. Smart cleanup was kept.",
            );
          text = candidate;
          appliedEditingModel=requestedEditingModel;
        } catch (e) {
          if (modeRef.current === "command") throw e;
          // Automatic cleanup keeps the transcript silently when editing is unavailable.
        } finally {
          clearTimeout(timeout);
        }
      }
      if (session.current !== token) return;
      if (!text.trim())
        throw new Error(
          "No words were recognized. Try speaking a little closer to the microphone.",
        );
      const record: Transcript = {
        ...pending!,
        id: pending!.id,
        text,
        raw,
        status: "complete",
        error: "",
        processingMs: Math.round(performance.now()-processingStarted),
        createdAt: pending!.createdAt,
        duration,
        source: config.provider,
        model:
          config.provider === "local"
            ? models[config.localModel].name
            : config.provider === "groq"
              ? "whisper-large-v3-turbo"
              : config.provider === "openai"
                ? "whisper-1"
                : config.cloudModel,
        style: config.style,
        starred: false,
        updatedAt: Date.now(),
        targetApp: destination || "Murmur",
        mode: modeRef.current,
        instruction: modeRef.current === "command" ? raw : undefined,
        originalText:
          modeRef.current === "command" ? commandOriginal.current : undefined,
        editingModel:appliedEditingModel,
        requestedEditingModel,
      };
      const target = recordTargetRef.current;
      processingRecord.current=record;
      let inserted = false;
      let editorValue = text;
      if (target?.element.isConnected) {
        const { element, start, end } = target;
        const prefix = element.value.slice(0, start),
          suffix = element.value.slice(end);
        const value =
          prefix +
          (prefix && !/\s$/.test(prefix) ? " " : "") +
          text +
          (suffix && !/^\s/.test(suffix) ? " " : "") +
          suffix;
        if (element === textArea.current) editorValue = value;
        else {
          const descriptor = Object.getOwnPropertyDescriptor(
            element instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype,
            "value",
          );
          descriptor?.set?.call(element, value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const cursor =
          prefix.length + (prefix && !/\s$/.test(prefix) ? 1 : 0) + text.length;
        requestAnimationFrame(() => {
          if (element.isConnected) element.setSelectionRange(cursor, cursor);
        });
        inserted = true;
      }
      setDraft(editorValue);
      setLastRecord(record.id);
      let saved = false;
      try {
        await db.saveTranscript(record);
        setHistory((old) => [record, ...old.filter(item=>item.id!==record.id)]);
        setRetryRecord(null);
        setStorageError("");
        saved = true;
      } catch (e) {
        setStorageError(safeError(e));
      }
      if(session.current !== token)return;
      const copied =
        !inserted && config.autoCopy && !setupRef.current
          ? await copy(text, true)
          : false;
      if (!saved)
        say(
          "Your words are in the editor, but device storage could not save them. Copy or export them before leaving.",
          true,
        );
      else if (inserted) say("Added to your text field and saved to history.");
      else if (copied) say("Copied to clipboard");
      else if (config.autoCopy)
        say("Saved to history. Tap Copy to give the browser clipboard access.");
      else say("Saved to your private history.");
    } catch (e) {
      if (session.current === token) {
        const message = safeError(e);
        if (pending) {
          const failed: Transcript = {...pending,status:"failed",error:message,updatedAt:Date.now()};
          await db.saveTranscript(failed).catch(()=>{});
          setHistory(old=>[failed,...old.filter(record=>record.id!==failed.id)]);setRetryRecord(failed);
        }
        say(pending ? `${message} Your recording is saved. Retry it here or in History.` : message,true);
      }
    } finally {
      clearTimeout(processingDeadline);
      const audioId = pending?.audioId || (recorder.current instanceof NativeRecorder ? recorder.current.audioId : "");
      if (audioId) native?.completeAudioProcessing?.(audioId);
      if (session.current === token) {
        setPhase("idle");phaseRef.current = "idle";cloudAbort.current = null;processingRecord.current=null;
      }
    }
  }
  useEffect(() => {
    const stopped = () => {
      if (phaseRef.current === "recording") cancelRecording();
    };
    const finish = () => {
      if (phaseRef.current !== "recording") return;
      // Finish from the notification or process audio saved before a mic interruption.
      void stopRef.current();
    };
    window.addEventListener("murmur-native-finish", finish);
    window.addEventListener("murmur-native-recording-error", finish);
    window.addEventListener("murmur-native-recording-stopped", stopped);
    return () => {
      window.removeEventListener("murmur-native-recording-stopped", stopped);
      window.removeEventListener("murmur-native-finish", finish);
      window.removeEventListener("murmur-native-recording-error", finish);
    };
  }, []);
  const stopRef = useRef(stopRecording);
  stopRef.current = stopRecording;
  function cancelRecording() {
    const interrupted=phaseRef.current;
    const capture=recorder.current;
    const pending=processingRecord.current;
    recordTargetRef.current = null;
    session.current++;
    cloudAbort.current?.abort();
    if (phaseRef.current === "editing") editing.cancel();
    if(pending && pending.status !== "complete") {
      const saved:Transcript={...pending,status:"saved",error:"Cancelled. Your audio is saved.",updatedAt:Date.now()};
      void db.saveTranscript(saved).then(()=>setHistory(old=>[saved,...old.filter(record=>record.id!==saved.id)]));
    }
    processingRecord.current=null;
    if (capture instanceof Recorder && interrupted === "recording") {
      void capture.stop().then(async audio=>{
        if(!audio.length)return;
        const audioId=id(),record:Transcript={id:audioId,audioId,text:"",raw:"",createdAt:Date.now(),duration:audio.length/16000,source:settingsRef.current.provider,model:"Saved audio",style:settingsRef.current.style,starred:false,status:"saved",error:"Cancelled. Your audio is saved."};
        await db.saveRecording(audio,record);setHistory(old=>[record,...old]);
      }).catch(()=>{});
    } else {void capture?.cleanup();void db.load().then(data=>setHistory(data.history));}
    if (
      phaseRef.current === "transcribing" &&
      settingsRef.current.provider === "local"
    ) {
      cancelLocal();
      setReadyModel(null);
    }
    setPhase("idle");
    phaseRef.current = "idle";
    setLevel(0);
    say("Recording cancelled.");
  }
  async function star(record: Transcript) {
    const next = { ...record, starred: !record.starred, updatedAt: Date.now() };
    try {
      await db.put("history", next);
      setHistory((old) => old.map((t) => (t.id === next.id ? next : t)));
    } catch (e) {
      say(safeError(e), true);
    }
  }
  function deleteRecord(record: Transcript) {
    setConfirm({
      title: "Delete this dictation?",
      body: "This will remove it from this device. This cannot be undone.",
      action: async () => {
        await db.remove("history", record.id);
        setHistory((old) => old.filter((t) => t.id !== record.id));
        if (lastRecord === record.id) setLastRecord(null);
        say("Dictation deleted.");
      },
    });
  }
  async function rewriteDraft(instruction: string) {
    if (phaseRef.current !== "idle" || !draft.trim()) return;
    const config = settingsRef.current;
    if (config.editingProvider === "basic") {
      navigate("models");
      say("Choose a local or cloud AI editing model for rewriting.", true);
      return;
    }
    if (
      config.editingProvider === "local" &&
      editing.ready !== config.editingModel
    ) {
      if (!(await editing.prepare(config.editingModel))) return;
    }
    const selected =
      targetRef.current?.element === textArea.current
        ? targetRef.current
        : null;
    const start =
        selected && selected.end > selected.start ? selected.start : 0,
      end =
        selected && selected.end > selected.start ? selected.end : draft.length;
    const original = draft.slice(start, end),
      before = draft;
    const token = ++session.current;
    const controller = new AbortController();
    cloudAbort.current = controller;
    setPhase("editing");
    phaseRef.current = "editing";
    const timeout = setTimeout(() => {
      controller.abort();
      if (config.editingProvider === "local") editing.cancel();
    }, 120000);
    try {
      const result = await editWriting(
        original,
        config,
        editingKeyProvider === config.editingProvider ? editingKey : "",
        null,
        controller.signal,
        instruction,
        original,
      );
      if (session.current !== token) return;
      const next = before.slice(0, start) + result + before.slice(end);
      setDraft(next);
      const record: Transcript = {
        id: id(),
        text: result,
        raw: original,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        duration: 0,
        source: config.provider,
        model: "Writing command",
        style: config.style,
        starred: false,
        mode: "command",
        instruction,
        originalText: original,
        editingModel:
          config.editingProvider === "local"
            ? editingModels[config.editingModel].name
            : config.editingCloudModel,
        targetApp: "Murmur",
      };
      await db.put("history", record);
      setHistory((old) => [record, ...old]);
      setLastRecord(start === 0 && end === before.length ? record.id : null);
      say("Rewritten and saved to History.");
    } catch (e) {
      if (session.current === token) say(safeError(e), true);
    } finally {
      clearTimeout(timeout);
      if (session.current === token) {
        setPhase("idle");
        phaseRef.current = "idle";
      }
      cloudAbort.current = null;
    }
  }
  async function saveDraft() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const existing = history.find((t) => t.id === lastRecord);
      if (existing) {
        const next = { ...existing, text: draft, updatedAt: Date.now() };
        await learnEdit(existing.text, draft);
        await db.put("history", next);
        setHistory((old) => old.map((t) => (t.id === next.id ? next : t)));
      } else {
        const next: Transcript = {
          id: id(),
          text: draft,
          raw: draft,
          createdAt: Date.now(),
          duration: 0,
          source: settings.provider,
          model: "Written note",
          style: settings.style,
          starred: false,
        };
        await db.put("history", next);
        setHistory((old) => [next, ...old]);
        setLastRecord(next.id);
      }
      setStorageError("");
      say("Saved to history.");
    } catch (e) {
      setStorageError(safeError(e));
      say(safeError(e), true);
    } finally {
      setBusy(false);
    }
  }
  function openVocab(kind: "words" | "snippets", existing?: Word | Snippet) {
    setVocabDialog({ kind, existing });
    setVocabFrom(
      existing
        ? "spoken" in existing
          ? existing.spoken
          : existing.phrase
        : "",
    );
    setVocabTo(
      existing
        ? "replacement" in existing
          ? existing.replacement
          : existing.text
        : "",
    );
  }
  async function saveVocab() {
    if (!vocabDialog || !vocabFrom.trim() || !vocabTo.trim()) return;
    setBusy(true);
    try {
      if (vocabDialog.kind === "words") {
        const next: Word = {
          id: vocabDialog.existing?.id || id(),
          spoken: vocabFrom.trim(),
          replacement: vocabTo.trim(),
          updatedAt: Date.now(),
        };
        await db.put("words", next);
        setWords((old) => [...old.filter((x) => x.id !== next.id), next]);
      } else {
        const next: Snippet = {
          id: vocabDialog.existing?.id || id(),
          phrase: vocabFrom.trim(),
          text: vocabTo.trim(),
          updatedAt: Date.now(),
        };
        await db.put("snippets", next);
        setSnippets((old) => [...old.filter((x) => x.id !== next.id), next]);
      }
      setVocabDialog(null);
      say("Your vocabulary has been updated.");
    } catch (e) {
      say(safeError(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function saveCloud() {
    setBusy(true);
    try {
      if (settings.provider === "custom") {
        validateEndpoint(cloudForm.endpoint);
        if (!cloudForm.model.trim())
          throw new Error("Enter your endpoint’s model name.");
      }
      await db.saveSecret("speech", cloudForm.key.trim(), cloudForm.remember, db.credentialScope(settings.provider, cloudForm.endpoint));
      const saved = await updateSettings({
        cloudEndpoint: cloudForm.endpoint.trim(),
        cloudModel: cloudForm.model.trim(),
        rememberKey: cloudForm.remember,
      });
      if (!saved)
        throw new Error("Provider settings could not be saved to this device.");
      setApiKey(cloudForm.key.trim());
      setSpeechKeyProvider(settings.provider);
      say("Provider settings saved.");
    } catch (e) {
      say(safeError(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function importBackup(file: File) {
    try {
      if (file.size > 25000000)
        throw new Error("Choose a backup smaller than 25 MB.");
      const data = validateBackup(JSON.parse(await file.text()));
      await db.restore(data);
      const loaded = await db.load();
      setHistory(loaded.history);
      setWords(loaded.words);
      setSnippets(loaded.snippets);
      say("Backup imported. Existing dictations have been kept.");
    } catch (e) {
      say(safeError(e), true);
    }
  }
  const exportBackup = () => {
    const exported = downloadFile(
      `murmur-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          app: "murmur",
          version: 1,
          exportedAt: new Date().toISOString(),
          transcripts: history,
          words,
          snippets,
        },
        null,
        2,
      ),
    );
    if (!exported) {
      say("Could not open your export. Try again.", true);
      return;
    }
    say("Your private backup is ready. Keep it somewhere safe.");
  };
  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") setInstallPrompt(null);
    } else setInstallHelp(true);
  }

  const webState = useRef({ history, settings });
  webState.current = { history, settings };
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!loaded || !context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: any) => {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: "search_dictation_history",
      title: "Search dictation history",
      description:
        "Read saved dictations on this device and display matching history results.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input: any) => {
        if (typeof input?.query !== "string" || input.query.length > 1000)
          throw new Error(
            "query must be a string with at most 1,000 characters",
          );
        if (phaseRef.current !== "idle")
          throw new Error("Finish recording first");
        setSearch(input.query);
        navigate("history");
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const records = webState.current.history.filter((t) =>
          t.text.toLowerCase().includes(input.query.toLowerCase()),
        );
        return {
          count: records.length,
          dictations: records
            .slice(0, 20)
            .map(({ id, text, createdAt }) => ({ id, text, createdAt })),
        };
      },
    });
    register({
      name: "read_dictation_preferences",
      title: "Read dictation preferences",
      description:
        "Read the active model, language, and dictation preferences. API keys are excluded.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input: any) => {
        if (!input || typeof input !== "object" || Object.keys(input).length)
          throw new Error("Expected an empty object");
        const prefs = webState.current.settings;
        return {
          provider: prefs.provider,
          localModel: prefs.localModel,
          language: prefs.language,
          style: prefs.style,
          autoCopy: prefs.autoCopy,
          floatingMic: prefs.floatingMic,
        };
      },
    });
    return () => lifecycle.abort();
  }, [loaded]);

  const matching = history.filter(
    (t) =>
      (historyFilter === "all" || t.starred) &&
      (t.text.toLowerCase().includes(search.toLowerCase()) ||
        t.model.toLowerCase().includes(search.toLowerCase())),
  );
  const isRecording = phase === "recording";
  const isWorking =
    phase === "starting" || phase === "transcribing" || phase === "editing";
  const recordButton = (
    <button
      className={`record-button ${isRecording ? "recording" : ""} ${isWorking ? "working" : ""}`}
      disabled={!loaded || isWorking || !!loadingModel || auxBusy || backgroundBusy}
      aria-label={isWorking ? "Working on dictation" : undefined}
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => actionRef.current()}
    >
      {isWorking ? (
        <LoaderCircle size={21} className="spin" />
      ) : isRecording ? (
        <Square size={17} fill="currentColor" />
      ) : (
        <Mic size={21} />
      )}
      {!isWorking && <span>{isRecording ? "Finish dictation" : "Start dictating"}</span>}
      {isRecording && <span className="record-time">{timeLabel(seconds)}</span>}
    </button>
  );
  function historyItem(t: Transcript, compact = false) {
    return (
      <article
        key={t.id}
        className={`history-item ${compact ? "compact" : ""}`}
      >
        <div className="transcript-icon">
          <AudioLines size={19} />
        </div>
        <button
          className="history-text"
          onClick={() => {
            setEditRecord(t);
            setEditText(t.text);
          }}
        >
          <span className="transcript-preview">{t.status === "failed" ? "Processing failed — audio saved" : !t.text ? (t.status === "processing" ? "Processing saved audio…" : "Saved recording") : t.text}</span>
          <span className="transcript-meta">
            {dateLabel(t.createdAt)}
            <span>·</span>
            {t.text ? `${wordCount(t.text)} words` : "Audio saved"}<span>·</span>
            {t.duration ? timeLabel(t.duration) : "Note"}
            {!compact && (
              <>
                <span>·</span>
                {t.model}
              </>
            )}
          </span>
        </button>
        <div className="history-actions">
          <button
            className={`icon-button ${t.starred ? "starred" : ""}`}
            aria-label={t.starred ? "Unstar dictation" : "Star dictation"}
            onClick={() => void star(t)}
          >
            <Star size={17} fill={t.starred ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            aria-label="Copy dictation"
            onClick={() => void copy(t.text)}
          >
            <Copy size={17} />
          </button>
          {!compact && (
            <button
              className="icon-button delete"
              aria-label="Delete dictation"
              onClick={() => deleteRecord(t)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
        {!compact&&t.raw&&t.mode!=="command"&&<details className="original-transcription">
          <summary>Original transcription</summary>
          <p>{t.raw}</p>
          <span className="transcript-meta">Speech: {t.model}{t.editingModel?` · Writing: ${t.editingModel}`:""}{t.requestedEditingModel&&t.requestedEditingModel!==t.editingModel?` · Configured: ${t.requestedEditingModel}`:""}</span>
        </details>}
        {!compact&&t.text&&settings.voiceModel==="piper-alba"&&<ReadAloud text={t.text} disabled={phase!=="idle"||backgroundBusy||auxBusy}/>}
        {!compact && t.audioId && t.status !== "recording" && <div className="recording-recovery">
          {t.error && <p className="recording-error">{t.error}</p>}
          <SavedAudio id={t.audioId}/>
          <button className="text-button" disabled={phase !== "idle" || auxBusy || backgroundBusy} onClick={()=>void stopRecording(t)}><RotateCcw size={14}/>{t.status === "failed" || !t.text ? "Retry saved audio" : "Reprocess audio"}</button>
          {t.processingMs !== undefined && t.status === "complete" && <span className="transcript-meta">Ready in {(t.processingMs/1000).toFixed(1)}s after recording</span>}
        </div>}
      </article>
    );
  }
  function emptyHistory() {
    return (
      <div className="empty-history">
        <div className="empty-icon">
          <AudioLines size={23} />
        </div>
        <div>
          <h3>A little space for your next thought.</h3>
          <p>
            Your dictations will be saved here. Start with whatever’s on your
            mind.
          </p>
        </div>
      </div>
    );
  }
  function modelsContent() {
    return (
      <>
        <div className="section-heading">
          <div>
            <h1>Find your voice.</h1>
            <p>Choose where your words come to life.</p>
          </div>
          <span className="small-tag">
            <Lock size={13} /> You’re in control
          </span>
        </div>
        <div
          className="provider-tabs"
          role="group"
          aria-label="Transcription location"
        >
          <button
            className={settings.provider === "local" ? "selected" : ""}
            disabled={!!loadingModel || auxBusy || phase !== "idle"}
            onClick={() => void updateSettings({ provider: "local" })}
          >
            <HardDrive size={18} />
            <span>On your device</span>
            <span className="tiny-badge">Free</span>
          </button>
          <button
            className={settings.provider !== "local" ? "selected" : ""}
            disabled={!!loadingModel || auxBusy || phase !== "idle"}
            onClick={() => void updateSettings({ provider: "openai" })}
          >
            <Cloud size={18} />
            <span>In the cloud</span>
            <span className="provider-byok">Your API key</span>
          </button>
        </div>
        {settings.provider === "local" ? (
          <>
            <div className="notice green">
              <ShieldCheck size={22} />
              <div>
                <strong>Your voice stays with you.</strong>
                <p>
                  Download a model here, then dictate offline. Speech recognition
                  runs while you talk. No account or subscription.
                </p>
              </div>
            </div>
            <div className="model-list">
              {speechModelOptions().map((model) => (
                <article
                  key={model}
                  className={`model-card ${settings.localModel === model ? "selected" : ""}`}
                >
                  <div className="model-radio">
                    <input
                      type="radio"
                      name="localModel"
                      id={`model-${model}`}
                      checked={settings.localModel === model}
                      disabled={!!loadingModel || auxBusy || phase !== "idle"}
                      onChange={() =>
                        void updateSettings({ localModel: model })
                      }
                    />
                  </div>
                  <div className="model-info">
                    <label htmlFor={`model-${model}`}>
                      <h3>{models[model].name}</h3>
                      <span
                        className="model-label recommended"
                      >
                        {models[model].label}
                      </span>
                    </label>
                    <p>{models[model].description}</p>
                    <span className="transcript-meta">
                      {models[model].languages}<span>·</span>{models[model].size}
                      <span>·</span>Quantized
                    </span>
                  </div>
                  <button
                    className={`button ${readyModel === model ? "muted" : "secondary"}`}
                    disabled={
                      !!loadingModel || auxBusy || phase !== "idle" || readyModel === model || !native?.prepareNativeSpeech
                    }
                    onClick={() => void prepareModel(model)}
                  >
                    {readyModel === model ? (
                      <Check size={16} />
                    ) : loadingModel === model ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    <span>
                      {readyModel === model
                        ? "Ready"
                        : loadingModel === model
                          ? "Loading…"
                          : cachedModels.includes(model)
                            ? "Load model"
                            : "Download"}
                    </span>
                  </button>
                  {cachedModels.includes(model) && (
                    <button
                      className="icon-button delete model-remove"
                      aria-label={`Remove ${models[model].name}`}
                      disabled={!!loadingModel || auxBusy || phase !== "idle"}
                      onClick={() =>
                        setConfirm({
                          title: "Remove this downloaded model?",
                          body: "Only the model files are removed. Your saved history, vocabulary, and snippets stay on this device.",
                          action: () => removeModel(model),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {loadingModel === model && (
                    <div className="model-loading">
                      <div className="progress-track">
                        <span style={{ width: `${modelProgress}%` }} />
                      </div>
                      <p>
                        {modelFile}
                        <span>{modelProgress}%</span>
                      </p>
                      <button className="text-button" onClick={cancelDownload}>
                        Cancel download
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <DeviceGuidance model={settings.localModel} withWriting={settings.editingProvider === "local"} />
            <ModelTrials history={history} cached={cachedModels} language={settings.language} disabled={phase!=="idle"||!!loadingModel||!!editing.loading||backgroundBusy||auxBusy} onBusy={setAuxBusy}/>
          </>
        ) : (
          <div className="cloud-panel panel">
            <div className="panel-heading">
              <h2>Bring your own provider</h2>
              <span className="small-tag">
                <Cloud size={13} /> Optional
              </span>
            </div>
            <div
              className="cloud-options"
              role="group"
              aria-label="Cloud provider"
            >
              {(["openai", "groq", "custom"] as Provider[]).map((p) => (
                <button
                  className={settings.provider === p ? "selected" : ""}
                  key={p}
                  onClick={() => void updateSettings({ provider: p })}
                >
                  {providerNames[p]}
                  {settings.provider === p && <Check size={16} />}
                </button>
              ))}
            </div>
            <div className="notice warm">
              <AlertCircle size={20} />
              <p>
                Cloud dictation sends your audio directly to the selected
                provider. The app is free; your provider may charge for usage.
                Nothing is sent until you start a cloud recording.
              </p>
            </div>
            <div className="form-grid">
              {settings.provider === "custom" && (
                <>
                  <label className="field-label full">
                    Transcription endpoint
                    <input
                      type="url"
                      data-no-dictate
                      value={cloudForm.endpoint}
                      onChange={(e) =>
                        setCloudForm({ ...cloudForm, endpoint: e.target.value })
                      }
                      placeholder="https://your-server.com/v1/audio/transcriptions"
                    />
                    <span>
                      Use an OpenAI-compatible endpoint that permits browser
                      requests (CORS).
                    </span>
                  </label>
                  <label className="field-label full">
                    Model name
                    <input
                      type="text"
                      data-no-dictate
                      value={cloudForm.model}
                      onChange={(e) =>
                        setCloudForm({ ...cloudForm, model: e.target.value })
                      }
                      placeholder="whisper-1"
                    />
                  </label>
                </>
              )}
              <label className="field-label full">
                API key{" "}
                <span className="optional">
                  {settings.provider === "custom"
                    ? "Optional for your server"
                    : "Required"}
                </span>
                <div className="key-input">
                  <input
                    autoComplete="off"
                    data-no-dictate
                    type={revealKey ? "text" : "password"}
                    value={cloudForm.key}
                    onChange={(e) =>
                      setCloudForm({ ...cloudForm, key: e.target.value })
                    }
                    placeholder={
                      settings.provider === "groq"
                        ? "gsk_…"
                        : "Enter your API key"
                    }
                  />
                  <button
                    className="text-button"
                    onClick={() => setRevealKey(!revealKey)}
                  >
                    {revealKey ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
            </div>
            <div className="setting-row">
              <div>
                <h3>Remember key on this device</h3>
                <p>
                  Otherwise, the key is cleared when you close or reload this
                  tab.
                </p>
              </div>
              <Toggle
                checked={cloudForm.remember}
                onChange={(remember) =>
                  setCloudForm({ ...cloudForm, remember })
                }
                label="Remember API key on this device"
              />
            </div>
            {cloudForm.remember && (
              <p className="security-note">
                <Lock size={14} />{" "}
                {native
                  ? "Remembered keys are encrypted with Android Keystore."
                  : "A remembered key is saved in browser storage."}
                Use this only on a trusted device.
              </p>
            )}
            <div className="form-footer">
              <span className="transcript-meta">
                {settings.provider === "openai"
                  ? "Model: whisper-1"
                  : settings.provider === "groq"
                    ? "Model: whisper-large-v3-turbo"
                    : "Audio format: WAV · JSON response"}
              </span>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void saveCloud()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Check size={17} />
                )}
                Save provider
              </button>
            </div>
          </div>
        )}
        <div inert={auxBusy}><EditingSettings
          settings={settings}
          update={updateSettings}
          download={editing}
          initialKey={editingKey}
          saveKey={saveEditingKey}
        /></div>
        <VoiceSettings settings={settings} update={updateSettings} disabled={phase!=="idle"||!!loadingModel||!!editing.loading||backgroundBusy||auxBusy} onBusy={setAuxBusy}/>
        <div className="bottom-note">
          <HelpCircle size={16} />
          <span>
            Switch providers anytime. Your history and vocabulary come with you.
          </span>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      {showSetup && (
        <Onboarding
          settings={settings}
          update={updateSettings}
          ready={readyModel}
          loading={loadingModel}
          progress={modelProgress}
          detail={modelFile}
          error={modelError}
          cached={cachedModels}
          prepare={prepareModel}
          cancel={cancelDownload}
          editing={editing}
          editingKey={editingKey}
          saveEditingKey={saveEditingKey}
          speechKey={speechKeyProvider === settings.provider ? apiKey : ""}
          saveSpeech={saveSpeechProvider}
          finish={finishSetup}
          phase={phase}
          captureError={actionError}
          recordButton={recordButton}
          result={draft}
          cancelRecording={cancelRecording}
        />
      )}
      <aside className="sidebar" inert={showSetup} aria-hidden={showSetup}>
        <Brand />
        <div className="workspace-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {navigation.slice(0, 3).map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "history" && history.length > 0 && (
                <span className="nav-count">{history.length}</span>
              )}
              {view === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
          <div className="workspace-label preferences-label">MAKE IT YOURS</div>
          {navigation.slice(3).map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {view === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <div className="privacy-icon">
              <ShieldCheck size={23} />
            </div>
            <strong>Private by nature.</strong>
            <p>
              Your device. Your words.
              <br />
              Your little corner of calm.
            </p>
            <button className="text-button" onClick={() => navigate("models")}>
              Explore local models
              <ChevronRight size={15} />
            </button>
          </div>
          <button className="sidebar-help" onClick={() => setHelp(true)}>
            <HelpCircle size={18} />
            <span>A little help</span>
            <kbd>?</kbd>
          </button>
          <div className="profile">
            <div className="profile-avatar">M</div>
            <div>
              <strong>Personal workspace</strong>
              <span>Free, by default</span>
            </div>
            <span className="free-label">FREE</span>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={showSetup} aria-hidden={showSetup}>
        <header className="topbar">
          <div className="mobile-brand">
            <Brand small />
          </div>
          <div className="breadcrumb">
            Your workspace
            <ChevronRight size={13} />
            <span>{navigation.find((n) => n.id === view)?.label}</span>
          </div>
          <div className="topbar-actions">
            <span
              className={`connection-tag ${settings.provider !== "local" ? "cloud" : ""}`}
            >
              {settings.provider === "local" ? (
                <ShieldCheck size={15} />
              ) : (
                <Cloud size={15} />
              )}
              <span>
                {settings.provider === "local"
                  ? "On-device mode"
                  : `${providerNames[settings.provider]} mode`}
              </span>
            </span>
            <button
              className="icon-button top-help"
              aria-label="Help and shortcuts"
              onClick={() => setHelp(true)}
            >
              <HelpCircle size={19} />
            </button>
            <button
              className="install-button"
              aria-label={native ? "Android setup settings" : "Get the app"}
              onClick={() => (native ? navigate("settings") : void install())}
            >
              {native ? <AudioLines size={15} /> : <Download size={15} />}
              <span>{native ? "Android setup" : "Get the app"}</span>
            </button>
          </div>
        </header>
        <main className={`main-content view-${view}`}>
          {storageError && (
            <div className="notice error">
              <AlertCircle size={20} />
              <p>
                {storageError} Your unsaved text stays in the editor. Export a
                backup before leaving.
              </p>
            </div>
          )}
          {actionError && !showSetup && (
            <div className="inline-error" role="alert">
              <AlertCircle size={18} /> <span>{actionError}</span>
              {retryRecord?.audioId && <button className="text-button" disabled={phase !== "idle" || backgroundBusy} onClick={()=>void stopRecording(retryRecord)}>Retry saved audio</button>}
              <button className="icon-button" aria-label="Dismiss error" onClick={() => setActionError("")}><X size={17} /></button>
            </div>
          )}
          {view === "dictate" && (
            <div className="simple-dictate">
              <div className="section-heading dictate-heading">
                <h1>Dictate</h1>
                <button className="text-button" onClick={() => navigate("history")}>History <ChevronRight size={15} /></button>
              </div>
              <section className={`record-panel ${isRecording ? "is-recording" : ""}`} aria-label="Voice recording">
                <div className="record-panel-top">
                  <span className="record-status">
                    {isRecording ? <><span className="live-dot" /><span>Listening</span></> : backgroundBusy || isWorking ? null : <><Mic size={15} /><span>{loadingModel ? "Loading model" : "Ready"}</span></>}
                  </span>
                  <button className="model-pill" disabled={phase !== "idle"} onClick={() => navigate("models")}>
                    {settings.provider === "local" ? <HardDrive size={13} /> : <Cloud size={13} />}
                    <span>{settings.provider === "local" ? models[settings.localModel].name : providerNames[settings.provider]}</span>
                    <ChevronDown size={13} />
                  </button>
                </div>
                {isRecording && <div className="compact-waveform" aria-hidden="true">
                  {Array.from({length: 25}, (_, i) => <span key={i} style={{height: `${6 + Math.abs(Math.sin(i*.61))*(10+level*40)}px`}} />)}
                </div>}
                <div className="record-actions">
                  {recordButton}
                  {phase !== "idle" && <button className="cancel-record" aria-label="Cancel recording" onClick={cancelRecording}><X size={18} /><span>Cancel</span></button>}
                </div>
                {recordingMode === "command" && <p className="command-hint">Speak an instruction for your selected text or draft.</p>}
                <div className="record-panel-footer">
                  <div className="inline-select"><Globe size={15} />
                    <select aria-label="Dictation language" value={settings.language} disabled={phase !== "idle"} onChange={(e) => void updateSettings({language: e.target.value})}>
                      {languageOptions(settings.provider,settings.localModel).map(([v,label]) => <option key={v} value={v}>{label}</option>)}
                    </select><ChevronDown size={12} />
                  </div>
                  <div className="inline-select"><Sparkles size={14} />
                    <select aria-label="Writing style" value={settings.style} disabled={phase !== "idle"} onChange={(e) => void updateSettings({style: e.target.value as Style})}>
                      <option value="natural">Natural style</option><option value="polished">Polished style</option><option value="verbatim">Verbatim</option>
                    </select><ChevronDown size={12} />
                  </div>
                </div>
              </section>
              <section className="editor-panel panel">
                <div className="panel-heading"><div className="panel-title"><FileText size={17} /><h2>Your words</h2></div><span className="editor-count">{wordCount(draft)} words</span></div>
                <textarea ref={textArea} readOnly={isWorking} aria-label="Dictation editor" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Speak or type here…" spellCheck />
                <div className="editor-footer">
                  <span className="editor-hint">Dictations saved automatically</span>
                  <div>
                    <button className="icon-button clear-editor" disabled={!draft || phase !== "idle"} aria-label="Clear editor" onClick={() => {setDraft("");setLastRecord(null);}}><RotateCcw size={15} /></button>
                    <button className="button small secondary" disabled={!draft.trim() || busy} onClick={() => void saveDraft()}>Save</button>
                    <button className="button small primary" disabled={!draft.trim()} onClick={() => void copy(draft)}><Copy size={14} />Copy</button>
                  </div>
                </div>
              </section>
              <details className="writing-menu">
                <summary onPointerDown={(e) => e.preventDefault()}><Sparkles size={15} />Writing tools<ChevronDown size={14} /></summary>
                <div className="record-mode" role="group" aria-label="Recording mode"><div className="segmented">
                  <button className={recordingMode === "dictate" ? "active" : ""} disabled={phase !== "idle"} onClick={() => setRecordingMode("dictate")}>Dictate</button>
                  <button className={recordingMode === "command" ? "active" : ""} disabled={phase !== "idle"} onPointerDown={(e) => e.preventDefault()} onClick={() => setRecordingMode("command")}><Command size={14} />Voice command</button>
                </div></div>
                <div className="writing-tools" aria-label="Writing commands">
                  {["Make it shorter","Make it more formal","Turn into a list","Translate to English"].map((instruction) => <button key={instruction} className="button secondary" disabled={phase !== "idle" || !draft.trim()} onPointerDown={(e) => e.preventDefault()} onClick={() => void rewriteDraft(instruction)}>{instruction}</button>)}
                </div>
              </details>
            </div>
          )}
          {view === "history" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Every thought, kept.</h1>
                  <p>
                    Your words have a home here. Pick up where you left off.
                  </p>
                </div>
                <button
                  className="button secondary"
                  disabled={!history.length}
                  onClick={exportBackup}
                >
                  <Download size={17} />
                  Export history
                </button>
              </div>
              <div className="history-toolbar">
                <div
                  className="segmented"
                  role="group"
                  aria-label="History filter"
                >
                  <button
                    className={historyFilter === "all" ? "active" : ""}
                    onClick={() => setHistoryFilter("all")}
                  >
                    All dictations<span>{history.length}</span>
                  </button>
                  <button
                    className={historyFilter === "starred" ? "active" : ""}
                    onClick={() => setHistoryFilter("starred")}
                  >
                    <Star size={14} />
                    Starred
                  </button>
                </div>
                <div className="search-input">
                  <Search size={17} />
                  <input
                    type="search"
                    data-no-dictate
                    aria-label="Search dictations"
                    placeholder="Find a thought…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="icon-button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="history-list panel">
                {matching.length ? (
                  matching.map((t) => historyItem(t))
                ) : history.length ? (
                  <div className="empty-state">
                    <Search size={32} />
                    <h3>No thoughts found.</h3>
                    <p>Try another search, or switch to all dictations.</p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSearch("");
                        setHistoryFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-art">
                      <AudioLines size={42} strokeWidth={1.4} />
                    </div>
                    <h2>Your story starts with a whisper.</h2>
                    <p>
                      Every dictation is saved here, ready to revisit, edit, or
                      copy.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => navigate("dictate")}
                    >
                      <Mic size={17} />
                      Make your first dictation
                    </button>
                  </div>
                )}
              </div>
              <div className="bottom-note">
                <ShieldCheck size={16} />
                <span>
                  History stays on this device. Export a backup before clearing
                  browser data or changing phones.
                </span>
              </div>
            </>
          )}
          {view === "dictionary" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>A language of your own.</h1>
                  <p>
                    Names, favorite phrases, and all the words that make you,
                    you.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => openVocab(dictionaryTab)}
                >
                  <Plus size={18} />
                  {dictionaryTab === "words" ? "Add a word" : "Add a snippet"}
                </button>
              </div>
              <div
                className="dictionary-tabs segmented"
                role="group"
                aria-label="Vocabulary type"
              >
                <button
                  className={dictionaryTab === "words" ? "active" : ""}
                  onClick={() => setDictionaryTab("words")}
                >
                  <BookOpen size={16} />
                  Personal dictionary<span>{words.length}</span>
                </button>
                <button
                  className={dictionaryTab === "snippets" ? "active" : ""}
                  onClick={() => setDictionaryTab("snippets")}
                >
                  <Sparkles size={16} />
                  Voice snippets<span>{snippets.length}</span>
                </button>
              </div>
              <div className="notice green">
                <BookOpen size={21} />
                <div>
                  <strong>
                    {dictionaryTab === "words"
                      ? "A little more like you."
                      : "Say less. Mean more."}
                  </strong>
                  <p>
                    {dictionaryTab === "words"
                      ? "Give a name or term its correct spelling. After transcription, Murmur replaces the phrase you specify."
                      : "Create a phrase like “my email signature” and expand it into your saved text."}{" "}
                    These apply in Natural and Polished styles.
                  </p>
                </div>
              </div>
              <div className="vocabulary-list panel">
                {(dictionaryTab === "words" ? words : snippets).length ? (
                  <>
                    <div className="vocab-table-heading">
                      <span>
                        {dictionaryTab === "words"
                          ? "WHAT YOU SAY"
                          : "TRIGGER PHRASE"}
                      </span>
                      <span>
                        {dictionaryTab === "words"
                          ? "HOW IT’S WRITTEN"
                          : "YOUR SAVED TEXT"}
                      </span>
                      <span />
                    </div>
                    {(dictionaryTab === "words" ? words : snippets).map(
                      (item) => (
                        <div className="vocab-row" key={item.id}>
                          <strong>
                            {"spoken" in item ? item.spoken : item.phrase}
                          </strong>
                          <span>
                            {"replacement" in item
                              ? item.replacement
                              : item.text}
                          </span>
                          <div>
                            <button
                              className="icon-button"
                              aria-label="Edit vocabulary"
                              onClick={() => openVocab(dictionaryTab, item)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button delete"
                              aria-label="Delete vocabulary"
                              onClick={() =>
                                setConfirm({
                                  title: "Remove this phrase?",
                                  body: "Future dictations will no longer use this replacement.",
                                  action: async () => {
                                    await db.remove(dictionaryTab, item.id);
                                    if (dictionaryTab === "words")
                                      setWords((old) =>
                                        old.filter((w) => w.id !== item.id),
                                      );
                                    else
                                      setSnippets((old) =>
                                        old.filter((w) => w.id !== item.id),
                                      );
                                  },
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-art">
                      <BookOpen size={38} strokeWidth={1.4} />
                    </div>
                    <h2>
                      {dictionaryTab === "words"
                        ? "Some words deserve special treatment."
                        : "Your favorite phrases, on speed dial."}
                    </h2>
                    <p>
                      {dictionaryTab === "words"
                        ? "Add a friend’s name, a company, or a term you use every day."
                        : "A signature, a greeting, or something you find yourself repeating."}
                    </p>
                    <div className="example-chips">
                      {dictionaryTab === "words" ? (
                        <>
                          <span>
                            “open a i” <ChevronRight size={12} /> OpenAI
                          </span>
                          <span>
                            “murmur app” <ChevronRight size={12} /> Murmur
                          </span>
                        </>
                      ) : (
                        <span>
                          “my sign off” <ChevronRight size={12} /> Talk soon,
                          Alex
                        </span>
                      )}
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => openVocab(dictionaryTab)}
                    >
                      <Plus size={17} />
                      {dictionaryTab === "words"
                        ? "Add your first word"
                        : "Create your first snippet"}
                    </button>
                  </div>
                )}
              </div>
              <div className="bottom-note">
                <Lock size={15} />
                <span>
                  Your personal vocabulary is saved only on this device and
                  included in your backup.
                </span>
              </div>
            </>
          )}
          {view === "models" && modelsContent()}
          {view === "settings" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Your flow. Your way.</h1>
                  <p>A few small things to make Murmur feel like home.</p>
                </div>
              </div>
              <div className="preferences-extras">
                <PreferencesExtras
                  settings={settings}
                  update={updateSettings}
                  history={history}
                  setup={() => {
                    setRecordingMode("dictate");
                    setSetupOpen(true);
                  }}
                  shareVocabulary={() =>
                    downloadFile(
                      "murmur-vocabulary.json",
                      JSON.stringify(
                        {
                          app: "murmur",
                          version: 1,
                          transcripts: [],
                          words,
                          snippets,
                        },
                        null,
                        2,
                      ),
                    )
                  }
                  importVocabulary={() => importInput.current?.click()}
                />
              </div>

              <section className="settings-panel panel">
                <div className="panel-heading">
                  <h2>Dictation</h2>
                  <Mic size={18} />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Copy when there’s no text field</h3>
                    <p>
                      Put completed dictations on your clipboard when the editor
                      isn’t focused.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.autoCopy}
                    label="Automatically copy to clipboard"
                    onChange={(autoCopy) => void updateSettings({ autoCopy })}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Floating microphone</h3>
                    <p>
                      Show the Murmur button when a text field is focused. Drag
                      it to the bottom centre to pause it for ten minutes.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.floatingMic}
                    label="Show floating microphone"
                    onChange={(floatingMic) =>
                      void updateSettings({ floatingMic })
                    }
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Floating button transparency</h3>
                    <p>Adjust how visible the floating control is.</p>
                  </div>
                  <label className="overlay-transparency">
                    <input type="range" aria-label="Floating button transparency" min="0" max="80" step="5" value={Math.round((1-settings.overlayOpacity)*100)} onChange={e=>void updateSettings({overlayOpacity:1-Number(e.target.value)/100})}/>
                    <output>{Math.round((1-settings.overlayOpacity)*100)}%</output>
                  </label>
                </div>
                {overlayPausedUntil>Date.now()&&<div className="setting-row">
                  <div><h3>Floating control paused</h3><p>Returns at {new Date(overlayPausedUntil).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}.</p></div>
                  <button className="button secondary" onClick={()=>{native?.resumeOverlay?.();setOverlayPausedUntil(0);}}>Resume now</button>
                </div>}
                <div className="setting-row">
                  <div>
                    <h3>A little less “um” and “uh”</h3>
                    <p>
                      Remove common filler words in Natural and Polished styles.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.removeFillers}
                    label="Remove filler words"
                    onChange={(removeFillers) =>
                      void updateSettings({ removeFillers })
                    }
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Say your punctuation</h3>
                    <p>
                      Use “new paragraph”, “comma”, or “question mark” in
                      Natural and Polished styles.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.voiceCommands}
                    label="Spoken punctuation commands"
                    onChange={(voiceCommands) =>
                      void updateSettings({ voiceCommands })
                    }
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Writing style</h3>
                    <p>
                      Natural tidies spacing. Polished adds a final full stop.
                      Verbatim keeps the model’s output.
                    </p>
                  </div>
                  <select
                    className="setting-select"
                    value={settings.style}
                    onChange={(e) =>
                      void updateSettings({ style: e.target.value as Style })
                    }
                  >
                    <option value="natural">Natural</option>
                    <option value="polished">Polished</option>
                    <option value="verbatim">Verbatim</option>
                  </select>
                </div>
              </section>
              <section className="settings-panel panel">
                <div className="panel-heading">
                  <h2>Your private data</h2>
                  <ShieldCheck size={18} />
                </div>
                <div className="setting-row">
                  <div>
                    <h3>A backup for your thoughts</h3>
                    <p>
                      Export history, dictionary, and voice snippets. API keys
                      are excluded.
                    </p>
                  </div>
                  <button className="button secondary" onClick={exportBackup}>
                    <Download size={16} />
                    Export
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Bring your history along</h3>
                    <p>Import a Murmur backup. Existing entries are kept.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => importInput.current?.click()}
                  >
                    <Upload size={16} />
                    Import
                  </button>
                </div>
                <div className="setting-row danger-row">
                  <div>
                    <h3>Clear dictation history</h3>
                    <p>
                      Permanently delete all {history.length} saved dictations
                      and their audio on this device.
                    </p>
                  </div>
                  <button
                    className="button danger"
                    disabled={!history.length}
                    onClick={() =>
                      setConfirm({
                        title: "Clear all your history?",
                        body: `All ${history.length} saved dictations and their audio will be removed from this device. Export a text backup and save any audio you want to keep first. Your vocabulary will remain.`,
                        action: async () => {
                          await db.clearHistory();
                          setHistory([]);
                          setLastRecord(null);
                          say("Your dictation history has been cleared.");
                        },
                      })
                    }
                  >
                    <Trash2 size={16} />
                    Clear history
                  </button>
                </div>
              </section>
              <section className="settings-panel panel">
                <div className="panel-heading">
                  <h2>
                    {native
                      ? "Use Murmur in other apps"
                      : "Take Murmur with you"}
                  </h2>
                  <Headphones size={18} />
                </div>
                {!native && (
                  <div className="setting-row">
                    <div><h3>Dictate across Android apps</h3><p>Install the Android APK and enable floating dictation during setup.</p></div>
                    <button className="button primary" onClick={() => void install()}><Download size={16} />Get the app</button>
                  </div>
                )}
                <div className="platform-note">
                  <AudioLines size={22} />
                  <div>
                    <strong>
                      {native
                        ? "Your words, wherever you type"
                        : "About dictating across other apps"}
                    </strong>
                    <p>
                      {native
                        ? "The floating control works with your current keyboard. Tap to start, tap again to finish, or use Cancel. Your words return to the active field, or to the clipboard if it is unavailable. Drag to save its position, or drop it at the bottom centre to pause for ten minutes."
                        : "The browser inserts into Murmur’s fields and can copy to your clipboard. The Android APK adds automatic floating dictation across apps."}
                    </p>
                  </div>
                </div>
              </section>
              <div className="about-murmur">
                <Brand small />
                <span>
                  Built around your voice. Powered by open-source speech models.
                </span>
                <span>{nativeLaunch.version || "v1.0"}</span>
              </div>
            </>
          )}
          {loaded && (
            <div hidden={view !== "settings"}>
              <SyncSettings
                settings={settings}
                update={updateSettings}
                revision={
                  history
                    .map((t) => t.id + ":" + (t.updatedAt || t.createdAt))
                    .join(",") +
                  "|" +
                  words.map((w) => w.id + ":" + w.updatedAt).join(",") +
                  "|" +
                  snippets.map((x) => x.id + ":" + x.updatedAt).join(",") +
                  "|" +
                  settings.preferencesUpdatedAt
                }
                idle={phase === "idle" && !showSetup}
                refresh={async () => {
                  const data = await db.load();
                  setHistory(data.history);
                  setWords(data.words);
                  setSnippets(data.snippets);
                  const next = normalizeSettings(data.settings);
                  settingsRef.current = next;
                  setSettings(next);
                }}
              />
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>Made for your thoughts.</span>
          <div>
            <span className="footer-flower">✳</span>
            <span>A little more human.</span>
          </div>
        </footer>
      </div>
      <nav
        className="mobile-nav"
        aria-label="Mobile navigation"
        inert={showSetup}
        aria-hidden={showSetup}
      >
        {navigation.map((n) => (
          <button
            key={n.id}
            aria-current={view === n.id ? "page" : undefined}
            className={view === n.id ? "active" : ""}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={20} />
            <span>{n.id === "models" ? "Models" : n.label}</span>
          </button>
        ))}
      </nav>
      {focused &&
        settings.floatingMic &&
        overlayPausedUntil<=Date.now() &&
        !showSetup &&
        !modelDialog &&
        !help &&
        !vocabDialog &&
        !editRecord &&
        !confirm && (
          <div className={`floating-dock ${isRecording||isWorking ? "active" : ""} ${isRecording ? "recording" : ""}`} style={{opacity:settings.overlayOpacity}}>
          <button
            className={`floating-mic ${isRecording ? "recording" : ""}`}
            aria-label={
              isRecording
                ? "Finish dictation into text field"
                : "Dictate into focused text field"
            }
            disabled={isWorking || !!loadingModel}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => actionRef.current()}
          >
            {isWorking ? (
              <LoaderCircle className="spin" size={26} />
            ) : isRecording ? (
              <span className="floating-wave" aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} style={{height:`${Math.min(26,10+(i%3)*5+level*10)}px`,animationDelay:`${i*-.12}s`}}/>)}</span>
            ) : (
              <span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span>
            )}
          </button>
          {(isRecording||isWorking)&&<button className="floating-cancel" aria-label="Cancel floating dictation" onPointerDown={e=>e.preventDefault()} onClick={cancelRecording}><X size={19}/></button>}
          </div>
        )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={19} /> : <CheckCheck size={19} />}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <input
        ref={importInput}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="Import Murmur backup"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importBackup(file);
          e.target.value = "";
        }}
      />
      {modelDialog && (
        <Modal
          title={
            readyModel === settings.localModel
              ? "Your whisper is ready."
              : "A little setup. A lot of freedom."
          }
          onClose={() => {
            pendingModelTarget.current = null;
            if (loadingModel) cancelDownload();
            else setModelDialog(false);
          }}
        >
          <div className="setup-model-icon">
            <AudioLines size={34} />
          </div>
          <p className="modal-intro">
            {readyModel === settings.localModel
              ? "All set. Your voice will be transcribed on this device."
              : "Download a speech model to turn your voice into words, right on your device."}
          </p>
          <div className="setup-model-info">
            <div>
              <strong>{models[settings.localModel].name}</strong>
              <span>{models[settings.localModel].languages} · {models[settings.localModel].size}</span>
            </div>
            <span className="tiny-badge">Always free</span>
          </div>
          {loadingModel ? (
            <div className="setup-progress">
              <div className="progress-track">
                <span style={{ width: `${modelProgress}%` }} />
              </div>
              <p>
                <LoaderCircle className="spin" size={15} />
                {modelFile}
                <strong>{modelProgress}%</strong>
              </p>
              <button className="button secondary" onClick={cancelDownload}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="setup-benefits">
                <p>
                  <ShieldCheck size={16} />
                  Your audio stays on your device.
                </p>
                <p>
                  <HardDrive size={16} />
                  Downloaded files are cached for future use.
                </p>
                <p>
                  <Cloud size={16} />
                  Internet is needed for the first download.
                </p>
              </div>
              <button
                className="button primary full-button"
                onClick={() => {
                  if (readyModel === settings.localModel) {
                    setModelDialog(false);
                    void beginRecording();
                  } else void prepareModel(settings.localModel);
                }}
              >
                {readyModel === settings.localModel ? (
                  <Mic size={18} />
                ) : (
                  <Download size={18} />
                )}{" "}
                {readyModel === settings.localModel
                  ? "Start dictating"
                  : cachedModels.includes(settings.localModel)
                    ? `Load ${models[settings.localModel].name}`
                    : `Download ${models[settings.localModel].name}`}
              </button>
              <button
                className="text-button centered"
                onClick={() => {
                  setModelDialog(false);
                  navigate("models");
                }}
              >
                Choose another model or provider
                <ChevronRight size={14} />
              </button>
            </>
          )}
        </Modal>
      )}
      {help && (
        <Modal
          title="A little help goes a long way."
          onClose={() => setHelp(false)}
          wide
        >
          <div className="help-grid">
            <article>
              <span className="help-number">01</span>
              <h3>Let it out.</h3>
              <p>
                Choose your language and style, tap Start dictating, and speak
                naturally. Tap Finish when you’re done. Recordings can be up to
                three minutes.
              </p>
            </article>
            <article>
              <span className="help-number">02</span>
              <h3>Make it yours.</h3>
              <p>
                Tap a text field before recording to insert at the cursor.
                Otherwise your words appear in the editor and are copied if
                clipboard access is allowed.
              </p>
            </article>
            <article>
              <span className="help-number">03</span>
              <h3>Keep the good bits.</h3>
              <p>
                Dictations are saved to history on this device. Revisit, star,
                edit, or copy them anytime. Export a backup to keep them safe.
              </p>
            </article>
          </div>
          <div className="help-shortcuts">
            <h3>A little shortcut</h3>
            <div>
              <span>Start or finish dictation</span>
              <span>
                <kbd>⌘ / Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd>
              </span>
            </div>
            <div>
              <span>Cancel recording</span>
              <kbd>Esc</kbd>
            </div>
          </div>
          <div className="notice warm">
            <AudioLines size={22} />
            <p>
              {native
                ? "Enable the floating mic in Settings to dictate with your existing keyboard. Tap the mic to record, tap again to finish, or press Cancel. Drag it to set its position. Your words return to the active field, or to the clipboard if it is unavailable."
                : "Murmur can see text fields inside this app. It cannot float above other apps or type into them from a browser. Use Copy and Paste to move your words anywhere."}
            </p>
          </div>
          <details className="original-transcription">
            <summary>Local model credits</summary>
            <p>
              Parakeet TDT v3 by <a href="https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3" target="_blank" rel="noreferrer">NVIDIA</a>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. The INT8 ONNX conversion is by csukuangfj; Murmur does not fine-tune the weights.
            </p>
            <p>
              Qwen3 1.7B by the Qwen team, Alibaba Cloud, with Google’s LiteRT INT4 conversion. Qwen3, LiteRT-LM and Sherpa-ONNX use Apache 2.0 licenses. ONNX Runtime uses the MIT license.
            </p>
          </details>
          <div className="help-footer">
            <span>
              Local models work without provider fees. Cloud usage is billed
              by your provider.
            </span>
            <button className="button primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
      {installHelp && (
        <Modal
          title="Make a little space for Murmur."
          onClose={() => setInstallHelp(false)}
        >
          <div className="setup-model-icon">
            <Download size={30} />
          </div>
          <p className="modal-intro">
            Add Murmur to your home screen for a full-screen, app-like
            experience.
          </p>
          <div className="install-instructions">
            <article>
              <strong>On iPhone or iPad</strong>
              <p>
                Open this site in Safari. Tap Share, then “Add to Home Screen”
                and “Add”.
              </p>
            </article>
            <article>
              <strong>On Android</strong>
              <p>
                Try the Android test app to dictate with a floating mic in other
                apps.
              </p>
              <a
                className="text-button"
                href="https://github.com/cryptobredda/murmur/releases"
                download
              >
                View Android releases <Download size={14} />
              </a>
              <p>
                You can also install this web app from Chrome’s menu with “Add
                to Home screen” or “Install app”.
              </p>
            </article>
            <article>
              <strong>On your computer</strong>
              <p>
                Use the install icon in your browser’s address bar, if
                available.
              </p>
            </article>
          </div>
          <div className="notice green">
            <ShieldCheck size={20} />
            <p>
              Download a local model before going offline. Your browser manages
              model storage; export backups regularly.
            </p>
          </div>
          <button
            className="button primary full-button"
            onClick={() => setInstallHelp(false)}
          >
            Sounds good
          </button>
        </Modal>
      )}
      {vocabDialog && (
        <Modal
          title={
            vocabDialog.kind === "words"
              ? vocabDialog.existing
                ? "Edit your word."
                : "A word worth getting right."
              : vocabDialog.existing
                ? "Edit your snippet."
                : "A phrase that says more."
          }
          onClose={() => setVocabDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveVocab();
            }}
          >
            <p className="modal-intro">
              {vocabDialog.kind === "words"
                ? "Teach Murmur how to write a name or phrase your way."
                : "Say a short trigger phrase to insert your saved text."}
            </p>
            <label className="field-label">
              {vocabDialog.kind === "words" ? "What you say" : "Trigger phrase"}
              <input
                type="text"
                required
                maxLength={150}
                value={vocabFrom}
                onChange={(e) => setVocabFrom(e.target.value)}
                placeholder={
                  vocabDialog.kind === "words"
                    ? "e.g. open a i"
                    : "e.g. my email signature"
                }
                data-no-dictate
              />
            </label>
            <label className="field-label">
              {vocabDialog.kind === "words"
                ? "How it’s written"
                : "Your saved text"}
              {vocabDialog.kind === "words" ? (
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={vocabTo}
                  onChange={(e) => setVocabTo(e.target.value)}
                  placeholder="e.g. OpenAI"
                  data-no-dictate
                />
              ) : (
                <textarea
                  required
                  maxLength={5000}
                  value={vocabTo}
                  onChange={(e) => setVocabTo(e.target.value)}
                  placeholder="Talk soon, Alex"
                  data-no-dictate
                />
              )}
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setVocabDialog(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={busy || !vocabFrom.trim() || !vocabTo.trim()}
              >
                <Check size={16} />
                Save {vocabDialog.kind === "words" ? "word" : "snippet"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editRecord && (
        <Modal
          title="A thought worth revisiting."
          onClose={() => setEditRecord(null)}
          wide
        >
          <div className="edit-metadata">
            <span>{dateLabel(editRecord.createdAt)}</span>
            <span>{editRecord.model}</span>
            <span>{wordCount(editText)} words</span>
          </div>
          <textarea
            className="edit-transcript"
            aria-label="Edit saved dictation"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            data-no-dictate
          />
          <details className="original-transcript">
            <summary>Original transcription</summary>
            <p>{editRecord.raw}</p>
          </details>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() =>
                downloadFile(
                  `murmur-${editRecord.id.slice(0, 8)}.txt`,
                  editText,
                  "text/plain",
                )
              }
            >
              <Download size={16} />
              Export text
            </button>
            <button
              className="button secondary"
              onClick={() => void copy(editText)}
            >
              <Copy size={16} />
              Copy
            </button>
            <button
              className="button primary"
              disabled={busy || !editText.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const next = {
                    ...editRecord,
                    text: editText,
                    updatedAt: Date.now(),
                  };
                  await learnEdit(editRecord.text, editText);
                  await db.put("history", next);
                  setHistory((old) =>
                    old.map((t) => (t.id === next.id ? next : t)),
                  );
                  setEditRecord(null);
                  say("Your edits are saved.");
                } catch (e) {
                  say(safeError(e), true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={16} />
              Save changes
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p className="modal-intro">{confirm.body}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Keep it
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await confirm.action();
                  setConfirm(null);
                } catch (e) {
                  say(safeError(e), true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={16} />
              {busy ? "Removing…" : "Yes, remove"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default App;
