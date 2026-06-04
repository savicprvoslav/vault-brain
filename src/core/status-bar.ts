import type { HealthState } from "./health.ts";

export interface StatusView {
  text: string;
  tooltip: string;
}

export function renderStatus(state: HealthState, model: string): StatusView {
  if (state.server === "down") {
    return {
      text: "🔴 Vault Brain",
      tooltip: "Ollama not reachable. Start it: run `ollama serve` or open Ollama.app.",
    };
  }
  if (state.model === "missing") {
    return {
      text: "🟡 Vault Brain",
      tooltip: `Model "${model}" not pulled. Run: ollama pull ${model}`,
    };
  }
  const caps = state.caps.length ? state.caps.join(", ") : "no capabilities reported";
  return { text: "🟢 Vault Brain", tooltip: `Ready — ${model} (${caps})` };
}
