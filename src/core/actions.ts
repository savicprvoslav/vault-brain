import type { ChatMessage } from "./provider.ts";

export type ActionId = "summarize" | "improve" | "format" | "translate" | "grammar";

export interface QuickAction {
  id: ActionId;
  label: string;
  icon: string;
  mode: "replace" | "below";
}

export const ACTIONS: QuickAction[] = [
  { id: "summarize", label: "Summarize", icon: "list", mode: "below" },
  { id: "improve", label: "Improve", icon: "wand", mode: "replace" },
  { id: "format", label: "Format as Markdown", icon: "heading", mode: "replace" },
  { id: "translate", label: "Translate SR↔EN", icon: "languages", mode: "replace" },
  { id: "grammar", label: "Fix grammar & spelling", icon: "check", mode: "replace" },
];

const INSTRUCTIONS: Record<ActionId, string> = {
  summarize:
    "Summarize the user's text into at most 5 concise Markdown bullet points. Output ONLY the bullets, no preamble.",
  improve:
    "Rewrite the user's text to improve clarity, flow, and word choice while preserving meaning and any Markdown. Output ONLY the rewritten text — no preamble, no quotes.",
  format:
    "Reformat the user's text into clean, well-structured Markdown (headings, lists, tables where appropriate) WITHOUT changing the wording. Output ONLY the formatted Markdown.",
  translate:
    "If the user's text is in Serbian, translate it to English; if it is in English, translate it to Serbian. Preserve Markdown. Output ONLY the translation.",
  grammar:
    "Correct ONLY grammar, spelling, and punctuation in the user's text. Do not reword or change meaning. Output ONLY the corrected text.",
};

export function getAction(id: ActionId): QuickAction {
  const a = ACTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`unknown action: ${id}`);
  return a;
}

export function buildActionMessages(id: ActionId, selectedText: string): ChatMessage[] {
  return [
    { role: "system", parts: [{ type: "text", text: INSTRUCTIONS[id] }] },
    { role: "user", parts: [{ type: "text", text: selectedText }] },
  ];
}

export interface CustomPrompt {
  name: string;
  prompt: string;
}

// Parse user "Name :: instruction" lines (one per line) into custom prompts.
export function parseCustomPrompts(text: string): CustomPrompt[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l): CustomPrompt | null => {
      const i = l.indexOf("::");
      if (i < 0) return null;
      const name = l.slice(0, i).trim();
      const prompt = l.slice(i + 2).trim();
      return name && prompt ? { name, prompt } : null;
    })
    .filter((x): x is CustomPrompt => x !== null);
}
