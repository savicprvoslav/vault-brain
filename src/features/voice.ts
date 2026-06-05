import { Notice, TFile, TAbstractFile, moment, Menu, MarkdownView } from "obsidian";
import type VaultBrainPlugin from "../main.ts";

const now = (): { format: (f: string) => string } => (moment as unknown as () => { format: (f: string) => string })();
import { encodeWavPcm16 } from "../core/wav.ts";
import { buildVoiceMessages, buildMeetingMessages } from "../core/voice-prompt.ts";
import { parseVoiceOutput } from "../core/voice-parse.ts";
import { render } from "../core/template.ts";

export const AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "webm", "aac", "flac", "mp4"];

export function registerVoiceCommands(plugin: VaultBrainPlugin): void {
  plugin.addCommand({
    id: "process-voice-memo",
    name: "Voice memo → note (pick audio file)",
    callback: () => void pickAndProcess(plugin),
  });

  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
      if (file instanceof TFile && AUDIO_EXTS.includes(file.extension.toLowerCase())) {
        menu.addItem((item) =>
          item
            .setTitle("Vault Brain: Voice memo → note")
            .setIcon("microphone")
            .onClick(() => void processAudioFile(plugin, file))
        );
        menu.addItem((item) =>
          item
            .setTitle("Vault Brain: Process as meeting (who said what)")
            .setIcon("users")
            .onClick(() => void processAudioFile(plugin, file, "meeting"))
        );
      }
    })
  );
}

async function pickAndProcess(plugin: VaultBrainPlugin): Promise<void> {
  const audio = plugin.app.vault.getFiles().filter((f) => AUDIO_EXTS.includes(f.extension.toLowerCase()));
  if (audio.length === 0) {
    new Notice("Vault Brain: no audio files found in the vault.");
    return;
  }
  audio.sort((a, b) => b.stat.mtime - a.stat.mtime);
  await processAudioFile(plugin, audio[0]);
}

// Decode any audio to 16 kHz mono via Web Audio, then encode WAV. Original file untouched.
async function toWav16kMono(bytes: ArrayBuffer): Promise<Uint8Array> {
  const decodeCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(bytes.slice(0));
  } finally {
    await decodeCtx.close();
  }
  const targetRate = 16000;
  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return encodeWavPcm16(rendered.getChannelData(0), targetRate);
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function openAndReveal(plugin: VaultBrainPlugin, file: TFile): Promise<void> {
  const leaf = plugin.app.workspace.getLeaf(false);
  await leaf.openFile(file);
  const view = leaf.view;
  if (view instanceof MarkdownView) {
    const last = Math.max(0, view.editor.lineCount() - 1);
    view.editor.setCursor({ line: last, ch: 0 });
    view.editor.scrollIntoView({ from: { line: last, ch: 0 }, to: { line: last, ch: 0 } }, true);
  }
}

interface DailyNotesOptions { format?: string; folder?: string }
interface DailyNotesPlugin { instance?: { options?: DailyNotesOptions } }
interface AppWithInternal { internalPlugins?: { getPluginById(id: string): DailyNotesPlugin | undefined } }

async function resolveDailyNote(plugin: VaultBrainPlugin): Promise<TFile> {
  const dn = (plugin.app as unknown as AppWithInternal).internalPlugins?.getPluginById("daily-notes");
  const format: string = dn?.instance?.options?.format || "YYYY-MM-DD";
  const folder: string = (dn?.instance?.options?.folder || "").trim();
  const name = now().format(format);
  const path = folder ? `${folder}/${name}.md` : `${name}.md`;
  const existing = plugin.app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;
  return plugin.app.vault.create(path, "");
}

export async function processAudioBytes(plugin: VaultBrainPlugin, bytes: ArrayBuffer, title: string, kind: "memo" | "meeting" = "memo"): Promise<void> {
  const notice = new Notice(`Vault Brain: processing ${title}…`, 0);
  try {
    const wav = await toWav16kMono(bytes);
    const messages = kind === "meeting" ? buildMeetingMessages(bytesToBase64(wav)) : buildVoiceMessages(bytesToBase64(wav));
    let out = "";
    await plugin.activity.run(kind === "meeting" ? "Processing meeting" : "Transcribing memo", () =>
      plugin.provider.chatStream(messages, {
        signal: AbortSignal.timeout(300000),
        onToken: (t) => { out += t; },
      })
    );
    const sections = parseVoiceOutput(out);
    const filled = render(plugin.settings.outputTemplate, {
      date: now().format("YYYY-MM-DD"),
      title,
      summary: sections.summary,
      tasks: sections.tasks,
      transcript: sections.transcript,
    });
    let target: TFile;
    if (plugin.settings.dailyNoteMode === "new") {
      const path = `${title} (memo).md`;
      const existing = plugin.app.vault.getAbstractFileByPath(path);
      target = existing instanceof TFile ? existing : await plugin.app.vault.create(path, "");
      await plugin.app.vault.append(target, `${filled}\n`);
    } else {
      target = await resolveDailyNote(plugin);
      await plugin.app.vault.append(target, `\n${filled}\n`);
    }
    await openAndReveal(plugin, target);
    notice.hide();
    new Notice(`Vault Brain: memo added to "${target.basename}" ✓`);
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
  }
}

export async function processAudioFile(plugin: VaultBrainPlugin, file: TFile, kind: "memo" | "meeting" = "memo"): Promise<void> {
  const bytes = await plugin.app.vault.readBinary(file);
  await processAudioBytes(plugin, bytes, file.basename, kind);
}
