import { Notice, moment } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { processAudioBytes } from "./voice.ts";

type RecState = "inactive" | "recording" | "paused";

class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private starting = false;

  state(): RecState {
    return (this.mediaRecorder?.state as RecState | undefined) ?? "inactive";
  }
  isActive(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state !== "inactive";
  }
  // True while start() awaits the OS mic prompt or while recording — don't start again.
  isBusy(): boolean {
    return this.starting || this.isActive();
  }

  async start(deviceId?: string): Promise<void> {
    if (this.isBusy()) throw new Error("already recording");
    this.starting = true; // set before the await so a second click can't race getUserMedia
    try {
      const audio: MediaStreamConstraints["audio"] = deviceId ? { deviceId: { exact: deviceId } } : true;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.mediaRecorder.start();
    } finally {
      this.starting = false;
    }
  }

  pause(): void {
    if (this.mediaRecorder?.state === "recording") this.mediaRecorder.pause();
  }
  resume(): void {
    if (this.mediaRecorder?.state === "paused") this.mediaRecorder.resume();
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

  cancel(): void {
    const mr = this.mediaRecorder;
    if (mr) mr.onstop = null;
    this.chunks = [];
    try {
      mr?.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
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
  let bar: HTMLElement | null = null;
  let timerEl: HTMLElement | null = null;
  let pauseBtn: HTMLButtonElement | null = null;
  let interval: number | null = null;
  let elapsed = 0;
  let finishing = false;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const removeBar = () => {
    if (interval !== null) {
      window.clearInterval(interval);
      interval = null;
    }
    bar?.remove();
    bar = null;
    timerEl = null;
    pauseBtn = null;
  };

  const finish = async () => {
    if (finishing) return;
    if (interval !== null) {
      window.clearInterval(interval);
      interval = null;
    }
    finishing = true;
    if (bar) {
      bar.empty();
      bar.createSpan({ cls: "vault-brain-rec-timer", text: "⏳ Transcribing…" });
    }
    try {
      const bytes = await recorder.stop();
      removeBar();
      const stamp = (moment as unknown as () => { format: (f: string) => string })().format("YYYY-MM-DD HH-mm");
      await processAudioBytes(plugin, bytes, `Voice recording ${stamp}`);
    } catch (e) {
      removeBar();
      new Notice("Vault Brain error: " + (e as Error).message);
    }
  };

  const showBar = () => {
    finishing = false;
    elapsed = 0;
    bar = activeDocument.body.createDiv({ cls: "vault-brain-rec-bar" });
    bar.createSpan({ cls: "vault-brain-rec-dot", text: "🔴" });
    timerEl = bar.createSpan({ cls: "vault-brain-rec-timer", text: "0:00" });
    pauseBtn = bar.createEl("button", { text: "⏸ Pause" });
    const stopBtn = bar.createEl("button", { text: "■ Stop" });
    const cancelBtn = bar.createEl("button", { text: "✕ Cancel" });
    pauseBtn.onclick = () => {
      if (recorder.state() === "recording") {
        recorder.pause();
        pauseBtn?.setText("▶ Resume");
      } else if (recorder.state() === "paused") {
        recorder.resume();
        pauseBtn?.setText("⏸ Pause");
      }
    };
    stopBtn.onclick = () => { if (!finishing) void finish(); };
    cancelBtn.onclick = () => {
      if (finishing) return;
      recorder.cancel();
      removeBar();
      new Notice("Vault Brain: recording cancelled.");
    };
    interval = window.setInterval(() => {
      if (recorder.state() === "recording") {
        elapsed++;
        timerEl?.setText(fmt(elapsed));
      }
    }, 1000);
  };

  const startRecording = async () => {
    if (recorder.isBusy()) {
      new Notice("Vault Brain: already recording.");
      return;
    }
    try {
      await recorder.start(plugin.settings.micDeviceId || undefined);
      showBar();
    } catch (e) {
      new Notice("Vault Brain: couldn't access the microphone — " + (e as Error).message);
    }
  };

  plugin.addRibbonIcon("microphone", "Vault Brain: record voice memo", () => void startRecording());
  plugin.addCommand({ id: "start-recording", name: "Start voice recording", callback: () => void startRecording() });
  plugin.addCommand({
    id: "stop-recording",
    name: "Stop voice recording",
    callback: () => {
      if (recorder.isActive()) void finish();
    },
  });
  plugin.register(() => {
    recorder.cancel();
    removeBar();
  });
}
