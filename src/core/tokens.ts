// Rough token estimate: ~4 characters per token (good enough for EN and SR caps).
export function estimate(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate text so its estimate fits within capTokens. Reports whether it was cut.
export function truncateToBudget(text: string, capTokens: number): { text: string; truncated: boolean } {
  const capChars = Math.max(0, capTokens) * 4;
  if (text.length <= capChars) return { text, truncated: false };
  return { text: text.slice(0, capChars), truncated: true };
}
