import { estimate, truncateToBudget } from "./tokens.ts";

export interface NoteDoc {
  title: string;
  body: string;
}

export interface ContextResult {
  text: string;
  truncated: boolean;
  included: number; // count of notes (incl. active) that made it in
}

function block(n: NoteDoc): string {
  return `## ${n.title}\n${n.body}`;
}

// Active note is always included (truncated if it alone exceeds the cap);
// linked notes are appended in order until the cap is reached.
export function assembleContext(active: NoteDoc, linked: NoteDoc[], capTokens: number): ContextResult {
  let text = block(active);
  if (estimate(text) > capTokens) {
    return { text: truncateToBudget(text, capTokens).text, truncated: true, included: 1 };
  }
  let included = 1;
  let truncated = false;
  for (const n of linked) {
    const next = `${text}\n\n${block(n)}`;
    if (estimate(next) > capTokens) {
      truncated = true;
      break;
    }
    text = next;
    included++;
  }
  return { text, truncated, included };
}
