import { estimate } from "./tokens.ts";

export interface RagHit {
  path: string;
  title: string;
  text: string;
  score: number;
}

export interface RagContext {
  text: string;
  sources: string[];
  truncated: boolean;
}

// Join retrieved chunks under their note titles within the token cap; dedup sources.
export function assembleRagContext(hits: RagHit[], capTokens: number): RagContext {
  const blocks: string[] = [];
  const sources: string[] = [];
  let used = 0;
  let truncated = false;
  for (const h of hits) {
    const block = `## ${h.title}\n${h.text}`;
    const cost = estimate(block) + 2;
    if (used + cost > capTokens) {
      truncated = true;
      break;
    }
    blocks.push(block);
    used += cost;
    if (!sources.includes(h.title)) sources.push(h.title);
  }
  return { text: blocks.join("\n\n"), sources, truncated };
}
