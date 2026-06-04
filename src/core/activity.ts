export type ActivityStatus = "running" | "done" | "error";

export interface ActivityEntry {
  id: number;
  label: string;
  status: ActivityStatus;
}

export class Activity {
  private nextId = 1;
  private entries: ActivityEntry[] = [];
  private runningIds = new Set<number>();
  private listeners: (() => void)[] = [];

  onChange(cb: () => void): void {
    this.listeners.push(cb);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  start(label: string): number {
    const id = this.nextId++;
    this.entries.unshift({ id, label, status: "running" });
    if (this.entries.length > 20) this.entries.length = 20;
    this.runningIds.add(id);
    this.emit();
    return id;
  }

  end(id: number, status: ActivityStatus = "done"): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) entry.status = status;
    this.runningIds.delete(id);
    this.emit();
  }

  async run<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const id = this.start(label);
    try {
      const result = await fn();
      this.end(id, "done");
      return result;
    } catch (e) {
      this.end(id, "error");
      throw e;
    }
  }

  runningCount(): number {
    return this.runningIds.size;
  }

  current(): ActivityEntry | null {
    for (const e of this.entries) {
      if (e.status === "running") return e;
    }
    return null;
  }

  recent(n = 10): ActivityEntry[] {
    return this.entries.slice(0, n);
  }
}

// Pure status-bar view-model.
export function renderActivity(running: number, current: string | null): { text: string; tooltip: string } {
  if (running === 0) return { text: "🧠", tooltip: "Vault Brain — idle (click for recent activity)" };
  if (running === 1) return { text: `🧠 ${current ?? "working"}…`, tooltip: current ?? "working" };
  return { text: `🧠 ${running} running…`, tooltip: `${running} operations running` };
}
