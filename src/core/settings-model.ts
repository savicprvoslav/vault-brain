export interface VaultBrainSettings {
  host: string;
  port: number;
  model: string;
  outputTemplate: string;
  dailyNoteMode: "append" | "new";
  contextTokenCap: number;
  outputLanguage: "auto" | "en" | "sr";
  keepAlive: boolean;
  embedModel: string;
  ragTopK: number;
  micDeviceId: string;
  customPrompts: string;
}

export const DEFAULT_TEMPLATE = `## 🎙️ Voice memo — {{date}}
**Summary**
{{summary}}

**Tasks**
{{tasks}}

**Transcript**
{{transcript}}
`;

export const DEFAULT_SETTINGS: VaultBrainSettings = {
  host: "http://127.0.0.1",
  port: 11434,
  model: "gemma4:latest",
  outputTemplate: DEFAULT_TEMPLATE,
  dailyNoteMode: "append",
  contextTokenCap: 8000,
  outputLanguage: "auto",
  keepAlive: false,
  embedModel: "nomic-embed-text:latest",
  ragTopK: 6,
  micDeviceId: "",
  customPrompts: "",
};

// Pure: merge persisted data over defaults, coercing/clamping invalid values.
export function normalizeSettings(raw: unknown): VaultBrainSettings {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<VaultBrainSettings>;
  const s: VaultBrainSettings = { ...DEFAULT_SETTINGS, ...data };

  const port = Number(s.port);
  s.port = Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_SETTINGS.port;

  const cap = Number(s.contextTokenCap);
  s.contextTokenCap = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : DEFAULT_SETTINGS.contextTokenCap;

  if (s.dailyNoteMode !== "append" && s.dailyNoteMode !== "new") s.dailyNoteMode = DEFAULT_SETTINGS.dailyNoteMode;
  if (s.outputLanguage !== "auto" && s.outputLanguage !== "en" && s.outputLanguage !== "sr")
    s.outputLanguage = DEFAULT_SETTINGS.outputLanguage;
  if (typeof s.host !== "string" || s.host.trim() === "") s.host = DEFAULT_SETTINGS.host;
  if (typeof s.model !== "string" || s.model.trim() === "") s.model = DEFAULT_SETTINGS.model;
  if (typeof s.outputTemplate !== "string") s.outputTemplate = DEFAULT_SETTINGS.outputTemplate;
  s.keepAlive = Boolean(s.keepAlive);

  if (typeof s.embedModel !== "string" || s.embedModel.trim() === "") s.embedModel = DEFAULT_SETTINGS.embedModel;
  const k = Number(s.ragTopK);
  s.ragTopK = Number.isInteger(k) && k >= 1 && k <= 50 ? k : DEFAULT_SETTINGS.ragTopK;

  if (typeof s.micDeviceId !== "string") s.micDeviceId = DEFAULT_SETTINGS.micDeviceId;
  if (typeof s.customPrompts !== "string") s.customPrompts = DEFAULT_SETTINGS.customPrompts;

  return s;
}
