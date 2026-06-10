export interface EditorPos { line: number; ch: number }

// Pure: the position after appending `text` at `pos`.
export function advancePos(pos: EditorPos, text: string): EditorPos {
  const parts = text.split("\n");
  if (parts.length === 1) return { line: pos.line, ch: pos.ch + text.length };
  return { line: pos.line + parts.length - 1, ch: parts[parts.length - 1].length };
}
