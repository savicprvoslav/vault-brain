// Wrap the first plain-text occurrence of each existing note title in [[ ]] (whole-word,
// case-insensitive), skipping titles already inside a [[...]] link. Titles < 3 chars are ignored.
export function linkMentions(text: string, titles: string[]): string {
  const sorted = [...new Set(titles)].filter((t) => t.length >= 3).sort((a, b) => b.length - a.length);
  let result = text;
  for (const title of sorted) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?<!\\[\\[)${esc}(?![\\p{L}\\p{N}])(?!\\]\\]|\\|)`, "iu");
    const m = re.exec(result);
    if (!m) continue;
    const before = result.slice(0, m.index);
    const opens = (before.match(/\[\[/g) || []).length;
    const closes = (before.match(/\]\]/g) || []).length;
    if (opens > closes) continue; // inside an existing link
    result = result.slice(0, m.index) + `[[${m[0]}]]` + result.slice(m.index + m[0].length);
  }
  return result;
}
