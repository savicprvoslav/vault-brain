export interface SetupState {
  server: boolean;
  chatModel: boolean;
  embedModel: boolean;
}

export interface SetupStep {
  id: "server" | "chat" | "embed";
  label: string;
  ok: boolean;
  fix?: string;
  action?: "pull" | "link";
  target?: string;
}

export function setupSteps(state: SetupState, chatModelName: string, embedModelName: string): SetupStep[] {
  return [
    {
      id: "server",
      label: "Ollama is running",
      ok: state.server,
      fix: state.server ? undefined : "Install Ollama, then start it (run `ollama serve` or open the app).",
      action: state.server ? undefined : "link",
      target: "https://ollama.com/download",
    },
    {
      id: "chat",
      label: `Model "${chatModelName}" installed — voice, vision & chat`,
      ok: state.chatModel,
      fix: state.chatModel ? undefined : `ollama pull ${chatModelName}`,
      action: state.chatModel ? undefined : "pull",
      target: chatModelName,
    },
    {
      id: "embed",
      label: `Model "${embedModelName}" installed — whole-vault search (optional)`,
      ok: state.embedModel,
      fix: state.embedModel ? undefined : `ollama pull ${embedModelName}`,
      action: state.embedModel ? undefined : "pull",
      target: embedModelName,
    },
  ];
}

// Voice/vision/chat need only the server + chat model; the embed model is optional.
export function setupComplete(state: SetupState): boolean {
  return state.server && state.chatModel;
}
