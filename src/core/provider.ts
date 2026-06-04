// Multimodal content part. Audio is always normalized to wav before reaching here.
export type Part =
  | { type: "text"; text: string }
  | { type: "image"; mime: string; dataB64: string }
  | { type: "audio"; format: "wav"; dataB64: string };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  parts: Part[];
}

export interface ChatStreamOpts {
  signal: AbortSignal;
  onToken: (token: string) => void;
}

// Decouples features from Ollama specifics; future MLX/other = new implementation.
export interface LlmProvider {
  chatStream(messages: ChatMessage[], opts: ChatStreamOpts): Promise<string>;
  listModels(): Promise<string[]>;
  showCapabilities(model: string): Promise<string[]>;
  embed(model: string, texts: string[]): Promise<number[][]>;
}
