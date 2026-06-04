import type { ChatMessage } from "./provider.ts";

export interface QaTurn {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM = `You are Vault Brain, answering questions about the user's Obsidian notes.
Use ONLY the CONTEXT below. If the answer is not in the context, say you don't know rather than guessing.
Be concise and reference note titles when useful.`;

// system (with context) -> prior turns -> new question
export function buildQaMessages(contextText: string, history: QaTurn[], question: string): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", parts: [{ type: "text", text: `${SYSTEM}\n\nCONTEXT:\n\n${contextText}` }] },
  ];
  for (const turn of history) {
    messages.push({ role: turn.role, parts: [{ type: "text", text: turn.text }] });
  }
  messages.push({ role: "user", parts: [{ type: "text", text: question }] });
  return messages;
}
