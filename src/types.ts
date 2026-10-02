export type View = "dictate" | "history" | "dictionary" | "models" | "settings";
export type Provider = "local" | "openai" | "groq" | "custom";
export type Style = "natural" | "polished" | "verbatim";
export type LocalModel = "parakeet-v3";
export type EditingModel = "qwen3-native";
export type EditingProvider = "basic" | "local" | "openai" | "groq" | "custom";
export type Tone = "neutral" | "formal" | "casual" | "very-casual";
export interface WritingProfile {
  id: string;
  name: string;
  packages: string;
  tone: Tone;
  format: "auto" | "email" | "list" | "code";
  instruction: string;
}
export interface Transcript {
  id: string;
  text: string;
  raw: string;
  createdAt: number;
  duration: number;
  source: Provider;
  model: string;
  style: Style;
  starred: boolean;
  updatedAt?: number;
  targetApp?: string;
  mode?: "dictate" | "command";
  instruction?: string;
  originalText?: string;
  editingModel?: string;
  requestedEditingModel?: string;
  audioId?: string;
  status?: "recording" | "processing" | "saved" | "failed" | "complete";
  error?: string;
  attempts?: number;
  processingMs?: number;
}
export interface Word {
  id: string;
  spoken: string;
  replacement: string;
  updatedAt?: number;
}
export interface Snippet {
  id: string;
  phrase: string;
  text: string;
  updatedAt?: number;
}
export interface Settings {
  provider: Provider;
  localModel: LocalModel;
  language: string;
  style: Style;
  autoCopy: boolean;
  removeFillers: boolean;
  voiceCommands: boolean;
  floatingMic: boolean;
  overlayOpacity: number;
  cloudEndpoint: string;
  cloudModel: string;
  rememberKey: boolean;
  onboardingComplete: boolean;
  correctSpeech: boolean;
  formatLists: boolean;
  autoLearn: boolean;
  editingProvider: EditingProvider;
  editingModel: EditingModel;
  editingEndpoint: string;
  editingCloudModel: string;
  rememberEditingKey: boolean;
  tone: Tone;
  profiles: WritingProfile[];
  syncEndpoint: string;
  syncUsername: string;
  syncScope: "all" | "vocabulary";
  rememberSync: boolean;
  autoSync: boolean;
  preferencesUpdatedAt: number;
}
export const defaults: Settings = {
  provider: "local",
  localModel: "parakeet-v3",
  language: "auto",
  style: "natural",
  autoCopy: true,
  removeFillers: true,
  voiceCommands: true,
  floatingMic: true,
  overlayOpacity: 1,
  cloudEndpoint: "",
  cloudModel: "whisper-1",
  rememberKey: false,
  onboardingComplete: false,
  correctSpeech: true,
  formatLists: true,
  autoLearn: true,
  editingProvider: "basic",
  editingModel: "qwen3-native",
  editingEndpoint: "",
  editingCloudModel: "gpt-4.1-mini",
  rememberEditingKey: false,
  tone: "neutral",
  syncEndpoint: "",
  syncUsername: "",
  syncScope: "all",
  rememberSync: false,
  autoSync: false,
  preferencesUpdatedAt: 0,
  profiles: [
    {
      id: "email",
      name: "Email",
      packages: "com.google.android.gm,gmail,outlook,email",
      tone: "formal",
      format: "email",
      instruction: "",
    },
    {
      id: "messages",
      name: "Messages",
      packages: "whatsapp,messaging,messages,telegram,signal",
      tone: "casual",
      format: "auto",
      instruction: "",
    },
    {
      id: "work",
      name: "Work chat",
      packages: "slack,teams,discord",
      tone: "neutral",
      format: "auto",
      instruction: "",
    },
    {
      id: "notes",
      name: "Notes & documents",
      packages: "notion,docs,notes,keep",
      tone: "neutral",
      format: "auto",
      instruction: "",
    },
    {
      id: "code",
      name: "Code & terminal",
      packages: "termux,code,terminal",
      tone: "neutral",
      format: "code",
      instruction:
        "Preserve exact code, identifiers, file names, and indentation.",
    },
  ],
};
export const models = {
  "parakeet-v3": {
    name: "Parakeet TDT v3", repo: "parakeet-v3", engine: "native", languages: "25 European languages",
    size: "670 MB", description: "600M-parameter native recognition with punctuation and capitalization. Runs offline on your phone after download.", label: "Local speech",
  },
} as const;
export function speechModelOptions() { return Object.keys(models) as LocalModel[]; }
export function supportsSpeechLanguage(_model: LocalModel, language: string) {
  return language === "auto" || "bg hr cs da nl en et fi fr de el hu it lv lt mt pl pt ro sk sl es sv ru uk".split(" ").includes(language);
}
// Normalize preferences from upgrades, imports and sync without resetting setup or cloud configuration.
export function normalizeSettings(saved?: Partial<Settings>): Settings {
  const result = { ...defaults, ...saved, localModel: "parakeet-v3" as const, editingModel: "qwen3-native" as const };
  if (result.provider === "local" && !supportsSpeechLanguage(result.localModel, result.language)) result.language = "auto";
  return result;
}
export function languageOptions(provider: Provider) {
  return languages.filter(([code]) => provider !== "local" || supportsSpeechLanguage("parakeet-v3", code));
}
export const languages = [
  ["auto", "Detect language"],
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
  ["hi", "Hindi"],
  ["ar", "Arabic"],
  ["ru", "Russian"],
  ["nl", "Dutch"],
  ["uk", "Ukrainian"],
  ["af", "Afrikaans"],
  ["sq", "Albanian"],
  ["am", "Amharic"],
  ["hy", "Armenian"],
  ["as", "Assamese"],
  ["az", "Azerbaijani"],
  ["ba", "Bashkir"],
  ["eu", "Basque"],
  ["be", "Belarusian"],
  ["bn", "Bengali"],
  ["bs", "Bosnian"],
  ["br", "Breton"],
  ["bg", "Bulgarian"],
  ["ca", "Catalan"],
  ["hr", "Croatian"],
  ["cs", "Czech"],
  ["da", "Danish"],
  ["et", "Estonian"],
  ["fo", "Faroese"],
  ["fi", "Finnish"],
  ["gl", "Galician"],
  ["ka", "Georgian"],
  ["el", "Greek"],
  ["gu", "Gujarati"],
  ["ht", "Haitian Creole"],
  ["ha", "Hausa"],
  ["haw", "Hawaiian"],
  ["he", "Hebrew"],
  ["hu", "Hungarian"],
  ["is", "Icelandic"],
  ["id", "Indonesian"],
  ["jw", "Javanese"],
  ["kn", "Kannada"],
  ["kk", "Kazakh"],
  ["km", "Khmer"],
  ["lo", "Lao"],
  ["la", "Latin"],
  ["lv", "Latvian"],
  ["ln", "Lingala"],
  ["lt", "Lithuanian"],
  ["lb", "Luxembourgish"],
  ["mk", "Macedonian"],
  ["mg", "Malagasy"],
  ["ms", "Malay"],
  ["ml", "Malayalam"],
  ["mt", "Maltese"],
  ["mi", "Maori"],
  ["mr", "Marathi"],
  ["mn", "Mongolian"],
  ["my", "Myanmar"],
  ["ne", "Nepali"],
  ["no", "Norwegian"],
  ["nn", "Nynorsk"],
  ["oc", "Occitan"],
  ["ps", "Pashto"],
  ["fa", "Persian"],
  ["pl", "Polish"],
  ["pa", "Punjabi"],
  ["ro", "Romanian"],
  ["sa", "Sanskrit"],
  ["sr", "Serbian"],
  ["sn", "Shona"],
  ["sd", "Sindhi"],
  ["si", "Sinhala"],
  ["sk", "Slovak"],
  ["sl", "Slovenian"],
  ["so", "Somali"],
  ["su", "Sundanese"],
  ["sw", "Swahili"],
  ["sv", "Swedish"],
  ["tl", "Tagalog"],
  ["tg", "Tajik"],
  ["ta", "Tamil"],
  ["tt", "Tatar"],
  ["te", "Telugu"],
  ["th", "Thai"],
  ["bo", "Tibetan"],
  ["tr", "Turkish"],
  ["tk", "Turkmen"],
  ["ur", "Urdu"],
  ["uz", "Uzbek"],
  ["vi", "Vietnamese"],
  ["cy", "Welsh"],
  ["yi", "Yiddish"],
  ["yo", "Yoruba"],
] as const;

export const editingModels = {
  "qwen3-native": {
    name: "Qwen3 1.7B Native", repo: "qwen3-native", engine: "native", languages: "Multilingual",
    size: "977 MB", dtype: "q4", description: "A larger instruction model using Android's native GPU runtime, with CPU fallback. Thinking is disabled for direct proofreading and writing commands.",
  },
} as const;
export function editingModelOptions() { return Object.keys(editingModels) as EditingModel[]; }
