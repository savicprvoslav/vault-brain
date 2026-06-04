// Extract the target path/name of an image embed on a single line, or null.
// Handles wiki embeds (![[target|alt]]) and markdown images (![alt](target)).
export function parseImageEmbed(line: string): string | null {
  const wiki = line.match(/!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/);
  if (wiki) return wiki[1].trim();
  const md = line.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (md) {
    try {
      return decodeURIComponent(md[1].trim());
    } catch {
      return md[1].trim();
    }
  }
  return null;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

export function mimeFromExtension(ext: string): string | null {
  return MIME[ext.toLowerCase()] ?? null;
}
