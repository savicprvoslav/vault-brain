// Split note text into ~maxTokens chunks on paragraph boundaries.
// Paragraphs larger than the cap are hard-split.
export function chunkNote(text: string, maxTokens = 500): string[] {
  const maxChars = Math.max(1, maxTokens * 4);
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  const chunks: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };
  for (const p of paras) {
    if (p.length > maxChars) {
      flush();
      for (let i = 0; i < p.length; i += maxChars) chunks.push(p.slice(i, i + maxChars));
      continue;
    }
    if (cur && cur.length + p.length + 2 > maxChars) flush();
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  flush();
  return chunks;
}
