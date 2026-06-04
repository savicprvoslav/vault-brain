import type { ChatMessage } from "./provider.ts";

const INSTRUCTION = `Extract ALL text and structure from this image as clean Markdown.
- Preserve headings, lists, and tables (render tables as Markdown tables).
- Transcribe text verbatim; do not summarize or add commentary.
- If the image contains no text, reply with exactly: (no text found)`;

export function buildVisionMessages(mime: string, dataB64: string): ChatMessage[] {
  return [
    {
      role: "user",
      parts: [
        { type: "text", text: INSTRUCTION },
        { type: "image", mime, dataB64 },
      ],
    },
  ];
}
