import type { ChatMessage } from "./provider.ts";

const SYSTEM = `You edit Markdown notes. Apply the user's instruction to the NOTE below and output ONLY the complete, revised note in Markdown — no preamble, no commentary, no surrounding code fences. Preserve everything the instruction does not change.`;

export function buildEditMessages(noteText: string, instruction: string): ChatMessage[] {
  return [
    { role: "system", parts: [{ type: "text", text: `${SYSTEM}\n\nNOTE:\n\n${noteText}` }] },
    { role: "user", parts: [{ type: "text", text: instruction }] },
  ];
}
