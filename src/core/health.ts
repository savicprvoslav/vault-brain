import type { LlmProvider } from "./provider.ts";

export interface HealthState {
  server: "up" | "down";
  model: "ready" | "missing" | "unknown";
  caps: string[];
}

export async function checkHealth(provider: LlmProvider, model: string): Promise<HealthState> {
  try {
    const models = await provider.listModels();
    const present = models.includes(model);
    let caps: string[] = [];
    if (present) {
      try {
        caps = await provider.showCapabilities(model);
      } catch {
        caps = [];
      }
    }
    return { server: "up", model: present ? "ready" : "missing", caps };
  } catch {
    return { server: "down", model: "unknown", caps: [] };
  }
}
