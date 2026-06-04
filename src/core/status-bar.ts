import type { HealthState } from "./health.ts";

export interface StatusView {
  text: string;
  tooltip: string;
  click: string;
}

export function renderStatus(state: HealthState, model: string): StatusView {
  if (state.server === "down") {
    const msg = "Ollama isn't running. Start it: run `ollama serve` or open the Ollama app.";
    return { text: "🔴 Vault Brain", tooltip: msg, click: msg };
  }
  if (state.model === "missing") {
    const msg = `Model "${model}" isn't pulled yet. Run:  ollama pull ${model}`;
    return { text: "🟡 Vault Brain", tooltip: msg, click: msg };
  }
  const caps = state.caps.length ? state.caps.join(", ") : "no capabilities reported";
  const msg = `Vault Brain ready — ${model} (${caps})`;
  return { text: "🟢 Vault Brain", tooltip: msg, click: msg };
}
