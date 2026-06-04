import type { ChatMessage } from "./provider.ts";

const INSTRUCTION = `You are processing a voice memo. Respond in the language spoken in the audio.
Output EXACTLY these three sections with these exact headers and nothing else:

### TRANSCRIPT
<verbatim transcript of everything spoken>

### SUMMARY
<up to 5 concise bullet points, each line starting with "- ">

### TASKS
<each actionable item as a Markdown checkbox line "- [ ] ..."; if there are none, write "- [ ] (none)">`;

export function buildVoiceMessages(audioB64: string): ChatMessage[] {
  return [
    {
      role: "user",
      parts: [
        { type: "text", text: INSTRUCTION },
        { type: "audio", format: "wav", dataB64: audioB64 },
      ],
    },
  ];
}
