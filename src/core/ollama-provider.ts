import type { ChatMessage, ChatStreamOpts, LlmProvider, Part } from "./provider.ts";

export type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

export interface ChatRequestBody {
  model: string;
  stream: boolean;
  messages: { role: string; content: OpenAiContentPart[] }[];
}

// Pure: map our Part to an OpenAI content part.
export function partToOpenAi(part: Part): OpenAiContentPart {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return { type: "image_url", image_url: { url: `data:${part.mime};base64,${part.dataB64}` } };
    case "audio":
      return { type: "input_audio", input_audio: { data: part.dataB64, format: part.format } };
  }
}

// Pure: build the /v1/chat/completions request body.
export function buildChatRequest(model: string, messages: ChatMessage[], stream: boolean): ChatRequestBody {
  return {
    model,
    stream,
    messages: messages.map((m) => ({ role: m.role, content: m.parts.map(partToOpenAi) })),
  };
}

interface SseChunk { choices?: { delta?: { content?: string; reasoning?: string } }[] }

export interface SseDelta {
  content: string; // the answer
  reasoning: string; // chain-of-thought from "thinking" models (e.g. gemma4:12b)
}

// Pure: parse one SSE line into its content + reasoning deltas. Returns null on [DONE].
export function parseSseDelta(line: string): SseDelta | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return { content: "", reasoning: "" };
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return null;
  try {
    const json = JSON.parse(data) as SseChunk;
    const delta = json.choices?.[0]?.delta;
    return { content: delta?.content ?? "", reasoning: delta?.reasoning ?? "" };
  } catch {
    return { content: "", reasoning: "" };
  }
}

// Backward-compatible: just the content delta ("" for non-content, null on [DONE]).
export function parseSseLine(line: string): string | null {
  const d = parseSseDelta(line);
  return d === null ? null : d.content;
}

export interface OllamaConfig {
  host: string; // e.g. "http://127.0.0.1"
  port: number; // e.g. 11434
  model: string; // e.g. "gemma4:12b"
  requestTimeoutMs?: number; // listModels/showCapabilities (default 8000)
  chatTimeoutMs?: number; // wall-clock cap for a streaming chat (default 300000)
}

export class OllamaProvider implements LlmProvider {
  // We intentionally use the web-standard `fetch` here, NOT Obsidian's requestUrl:
  // chatStream/pullModel need true streaming (token-by-token SSE, including the model's
  // "thinking" phase) which requestUrl cannot do, and `fetch` keeps this transport
  // unit-testable in plain Node. The endpoint is localhost-only so CORS is a non-issue
  // (Ollama allows the app://obsidian.md origin). fetchFn is injectable for testing; the
  // default wraps the global fetch unbound to avoid Chromium's "Illegal invocation" when
  // it is called as `this.fetchFn(...)`. Do NOT use window/globalThis here — keep Node-pure.
  constructor(
    private cfg: OllamaConfig,
    private fetchFn: typeof fetch = (...args: Parameters<typeof fetch>) => fetch(...args),
  ) {}

  private base(): string {
    return `${this.cfg.host}:${this.cfg.port}`;
  }

  async chatStream(messages: ChatMessage[], opts: ChatStreamOpts): Promise<string> {
    // Generous wall-clock cap: gemma4:12b streams a chain-of-thought (reasoning) before
    // the answer, so this must cover a full think + answer; callers may also pass their own
    // opts.signal. AbortSignal.timeout (not setTimeout) keeps this file free of window/timer
    // globals and Node-testable.
    // AbortSignal.any is available in Node 18.17+/browsers but not typed in TS 5.4's DOM lib.
    const signal = (AbortSignal as typeof AbortSignal & { any(signals: AbortSignal[]): AbortSignal }).any([
      opts.signal,
      AbortSignal.timeout(this.cfg.chatTimeoutMs ?? 300000),
    ]);
    const res = await this.fetchFn(`${this.base()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildChatRequest(this.cfg.model, messages, true)),
      signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama returned HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const delta = parseSseDelta(line);
        if (delta === null) return full; // [DONE]
        if (delta.reasoning) opts.onThinking?.(delta.reasoning);
        if (delta.content) {
          full += delta.content;
          opts.onToken(delta.content);
        }
      }
    }
    // Flush a complete-but-unterminated final line (stream ended without [DONE]).
    const tail = parseSseDelta(buffer);
    if (tail) {
      if (tail.reasoning) opts.onThinking?.(tail.reasoning);
      if (tail.content) {
        full += tail.content;
        opts.onToken(tail.content);
      }
    }
    return full;
  }

  // Load/refresh the model in Ollama WITHOUT generating: empty prompt + keep_alive.
  async keepWarm(): Promise<void> {
    const res = await this.fetchFn(`${this.base()}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.cfg.model, prompt: "", keep_alive: "10m" }),
      signal: AbortSignal.timeout(this.cfg.requestTimeoutMs ?? 8000),
    });
    if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
  }

  async listModels(): Promise<string[]> {
    const res = await this.fetchFn(`${this.base()}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(this.cfg.requestTimeoutMs ?? 8000),
    });
    if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
    const json = (await res.json()) as { models?: { name: string }[] };
    return (json.models ?? []).map((m) => m.name);
  }

  async showCapabilities(model: string): Promise<string[]> {
    const res = await this.fetchFn(`${this.base()}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(this.cfg.requestTimeoutMs ?? 8000),
    });
    if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
    const json = (await res.json()) as { capabilities?: string[] };
    return json.capabilities ?? [];
  }

  async embed(model: string, texts: string[]): Promise<number[][]> {
    const res = await this.fetchFn(`${this.base()}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
    const json = (await res.json()) as { embeddings?: number[][] };
    return json.embeddings ?? [];
  }

  async pullModel(model: string, onProgress: (status: string, pct: number) => void): Promise<void> {
    const res = await this.fetchFn(`${this.base()}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`Ollama returned HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let j: { status?: string; total?: number; completed?: number; error?: string };
        try {
          j = JSON.parse(line) as { status?: string; total?: number; completed?: number; error?: string };
        } catch {
          continue;
        }
        if (j.error) throw new Error(j.error);
        const pct = j.total && j.completed ? Math.round((j.completed / j.total) * 100) : 0;
        onProgress(j.status ?? "", pct);
      }
    }
  }
}
