import { Notice, TFile, TAbstractFile, moment, Menu } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { encodeWavPcm16 } from "../core/wav.ts";
import { buildVoiceMessages } from "../core/voice-prompt.ts";
import { parseVoiceOutput } from "../core/voice-parse.ts";
import { render } from "../core/template.ts";

const AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "webm", "aac", "flac", "mp4"];

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
    void decodeCtx.close();
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

async function resolveDailyNote(plugin: VaultBrainPlugin): Promise<TFile> {
  const dn = (plugin.app as any).internalPlugins?.getPluginById?.("daily-notes");
  const opts = dn?.instance?.options ?? {};
  const format: string = opts.format || "YYYY-MM-DD";
  const folder: string = (opts.folder || "").trim();
  const name = (moment as unknown as () => { format: (f: string) => string })().format(format);
  const path = folder ? `${folder}/${name}.md` : `${name}.md`;
  const existing = plugin.app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;
  return plugin.app.vault.create(path, "");
}

async function processAudioFile(plugin: VaultBrainPlugin, file: TFile): Promise<void> {
  const notice = new Notice(`Vault Brain: processing ${file.name}…`, 0);
  try {
    const bytes = await plugin.app.vault.readBinary(file);
    const wav = await toWav16kMono(bytes);
    const messages = buildVoiceMessages(bytesToBase64(wav));

    let out = "";
    await plugin.provider.chatStream(messages, {
      signal: AbortSignal.timeout(300000),
      onToken: (t) => {
        out += t;
      },
    });

    const sections = parseVoiceOutput(out);
    const filled = render(plugin.settings.outputTemplate, {
      date: (moment as unknown as () => { format: (f: string) => string })().format("YYYY-MM-DD"),
      title: file.basename,
      summary: sections.summary,
      tasks: sections.tasks,
      transcript: sections.transcript,
    });

    if (plugin.settings.dailyNoteMode === "new") {
      const path = `${file.basename} (memo).md`;
      const existing = plugin.app.vault.getAbstractFileByPath(path);
      const target = existing instanceof TFile ? existing : await plugin.app.vault.create(path, "");
      await plugin.app.vault.append(target, `${filled}\n`);
      await plugin.app.workspace.getLeaf(true).openFile(target);
    } else {
      const daily = await resolveDailyNote(plugin);
      await plugin.app.vault.append(daily, `\n${filled}\n`);
    }

    notice.hide();
    new Notice("Vault Brain: voice memo added.");
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
  }
}
