import type { ChatMessage } from "./provider.ts";

const SYSTEM = `You are a writing assistant. Continue the user's text naturally from where it ends, matching the tone, style, and Markdown formatting. Output ONLY the continuation — do not repeat the existing text, no preamble, no quotes.`;

export function buildContinueMessages(textBefore: string): ChatMessage[] {
  return [
    { role: "system", parts: [{ type: "text", text: SYSTEM }] },
    { role: "user", parts: [{ type: "text", text: textBefore }] },
  ];
}
