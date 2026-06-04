import type { ChatMessage } from "./provider.ts";

const SYSTEM = `Suggest 3 to 7 concise, lowercase tags for the note below (no # prefix, hyphenate multi-word tags). Output ONLY a comma-separated list of tags, nothing else.`;

export function buildTagMessages(noteText: string): ChatMessage[] {
  return [
    { role: "system", parts: [{ type: "text", text: SYSTEM }] },
    { role: "user", parts: [{ type: "text", text: noteText }] },
  ];
}

export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const t = raw.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase();
    if (t && /^[a-z0-9/_-]+$/.test(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, 7);
}
