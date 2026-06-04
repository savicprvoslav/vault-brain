export interface VoiceSections {
  transcript: string;
  summary: string;
  tasks: string;
}

function grab(text: string, name: string): string {
  const re = new RegExp(`###\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

// Parse the three-section output; if no headers, treat the whole text as the transcript.
export function parseVoiceOutput(text: string): VoiceSections {
  const transcript = grab(text, "TRANSCRIPT");
  const summary = grab(text, "SUMMARY");
  const tasks = grab(text, "TASKS");
  if (!transcript && !summary && !tasks) {
    return { transcript: text.trim(), summary: "", tasks: "" };
  }
  return { transcript, summary, tasks };
}
