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

// Pure: parse one SSE line. Returns delta text, "" for non-content lines, or null on [DONE].
export function parseSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return "";
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return null;
  try {
    const json = JSON.parse(data);
    return json.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

export interface OllamaConfig {
  host: string; // e.g. "http://127.0.0.1"
  port: number; // e.g. 11434
  model: string; // e.g. "gemma4:latest"
  requestTimeoutMs?: number; // listModels/showCapabilities (default 8000)
  chatTimeoutMs?: number; // overall cap for a streaming chat (default 120000)
}

export class OllamaProvider implements LlmProvider {
  // fetchFn is injectable for testing; defaults to the global fetch.
  constructor(private cfg: OllamaConfig, private fetchFn: typeof fetch = fetch) {}

  private base(): string {
    return `${this.cfg.host}:${this.cfg.port}`;
  }

  async chatStream(messages: ChatMessage[], opts: ChatStreamOpts): Promise<string> {
    // AbortSignal.any is available in Node 18.17+/browsers but not typed in TS 5.4's DOM lib.
    const signal = (AbortSignal as typeof AbortSignal & { any(signals: AbortSignal[]): AbortSignal }).any([
      opts.signal,
      AbortSignal.timeout(this.cfg.chatTimeoutMs ?? 120000),
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
        const delta = parseSseLine(line);
        if (delta === null) return full; // [DONE]
        if (delta) {
          full += delta;
          opts.onToken(delta);
        }
      }
    }
    // Flush a complete-but-unterminated final line (stream ended without [DONE]).
    const tail = parseSseLine(buffer);
    if (tail) {
      full += tail;
      opts.onToken(tail);
    }
    return full;
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
}
