import type { ChatMessage, Part } from "./provider.ts";

// Pure: map our Part to an OpenAI content part.
export function partToOpenAi(part: Part): unknown {
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
export function buildChatRequest(model: string, messages: ChatMessage[], stream: boolean): object {
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
