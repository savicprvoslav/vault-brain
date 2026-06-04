// Turn raw note/chunk Markdown into a clean one-line preview snippet.
export function cleanSnippet(text: string, maxLen = 120): string {
  let s = text;
  // leading YAML frontmatter
  s = s.replace(/^---[\s\S]*?---\s*/, "");
  // heading / blockquote markers (line-anchored)
  s = s.replace(/^[>\s]*#{1,6}\s+/gm, "");
  // list bullets + checkboxes
  s = s.replace(/^[ \t]*[-*+]\s+(\[[ xX]\]\s*)?/gm, "");
  s = s.replace(/^[ \t]*\d+\.\s+/gm, "");
  // wikilinks: [[a|b]] -> b, [[a]] -> a
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");
  // markdown links [t](u) -> t
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // emphasis + inline code
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1").replace(/`([^`]+)`/g, "$1");
  // template placeholders {{x}} -> x
  s = s.replace(/\{\{([^}]+)\}\}/g, "$1");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s.length > maxLen ? s.slice(0, maxLen).trimEnd() + "…" : s;
}
