import { Notice, moment } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { processAudioBytes } from "./voice.ts";

class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  async stop(): Promise<ArrayBuffer> {
    const mr = this.mediaRecorder;
    if (!mr) throw new Error("not recording");
    const done = new Promise<ArrayBuffer>((resolve, reject) => {
      mr.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: mr.mimeType || "audio/webm" });
          resolve(await blob.arrayBuffer());
        } catch (err) {
          reject(err as Error);
        } finally {
          this.cleanup();
        }
      };
    });
    mr.stop();
    return done;
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

export function registerRecorder(plugin: VaultBrainPlugin): void {
  const recorder = new Recorder();
  let statusEl: HTMLElement | null = null;

  const setRecordingUi = (on: boolean) => {
    if (on && !statusEl) {
      statusEl = plugin.addStatusBarItem();
      statusEl.setText("🔴 Recording…");
    } else if (!on && statusEl) {
      statusEl.remove();
      statusEl = null;
    }
  };

  const toggle = async () => {
    if (recorder.isRecording()) {
      setRecordingUi(false);
      const notice = new Notice("Vault Brain: finishing recording…", 0);
      try {
        const bytes = await recorder.stop();
        notice.hide();
        const stamp = (moment as unknown as () => { format: (f: string) => string })().format("YYYY-MM-DD HH-mm");
        await processAudioBytes(plugin, bytes, `Voice recording ${stamp}`);
      } catch (e) {
        notice.hide();
        new Notice("Vault Brain error: " + (e as Error).message);
      }
    } else {
      try {
        await recorder.start();
        setRecordingUi(true);
        new Notice("Vault Brain: recording… click the mic again to stop.");
      } catch (e) {
        new Notice("Vault Brain: couldn't access the microphone — " + (e as Error).message);
      }
    }
  };

  plugin.addRibbonIcon("microphone", "Vault Brain: record voice memo", () => void toggle());
  plugin.addCommand({
    id: "toggle-recording",
    name: "Start/stop voice recording",
    callback: () => void toggle(),
  });
}
