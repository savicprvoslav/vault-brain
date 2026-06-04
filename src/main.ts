import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { normalizeSettings, VaultBrainSettings } from "./core/settings-model.ts";
import { VaultBrainSettingTab } from "./settings.ts";
import { OllamaProvider } from "./core/ollama-provider.ts";
import { checkHealth } from "./core/health.ts";
import { renderStatus, StatusView } from "./core/status-bar.ts";
import { VaultBrainQaView, QA_VIEW_TYPE } from "./features/qa-view.ts";
import { registerVisionCommand } from "./features/vision.ts";
import { registerVoiceCommands } from "./features/voice.ts";

export default class VaultBrainPlugin extends Plugin {
  settings!: VaultBrainSettings;
  provider!: OllamaProvider;
  private statusEl!: HTMLElement;
  private statusView: StatusView | null = null;

  async onload() {
    await this.loadSettings();
    this.rebuildProvider();

    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText("⏳ Vault Brain");
    this.statusEl.addClass("vault-brain-status");
    this.registerDomEvent(this.statusEl, "click", () => {
      if (this.statusView) new Notice(this.statusView.click);
    });

    this.addSettingTab(new VaultBrainSettingTab(this.app, this));

    this.addCommand({
      id: "test-connection",
      name: "Test connection (stream a hello)",
      callback: () => this.testConnection(),
    });

    this.registerView(QA_VIEW_TYPE, (leaf) => new VaultBrainQaView(leaf, this));
    this.addRibbonIcon("message-circle", "Vault Brain Q&A", () => void this.activateQaView());
    this.addCommand({
      id: "open-qa",
      name: "Open Q&A panel",
      callback: () => void this.activateQaView(),
    });

    registerVisionCommand(this);
    registerVoiceCommands(this);

    await this.refreshHealth();
    this.registerInterval(window.setInterval(() => void this.refreshHealth(), 30000));
  }

  onunload() {}

  rebuildProvider() {
    this.provider = new OllamaProvider({
      host: this.settings.host,
      port: this.settings.port,
      model: this.settings.model,
    });
  }

  async loadSettings() {
    this.settings = normalizeSettings(await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.rebuildProvider();
    await this.refreshHealth();
  }

  async refreshHealth() {
    const state = await checkHealth(this.provider, this.settings.model);
    const view = renderStatus(state, this.settings.model);
    this.statusView = view;
    this.statusEl.setText(view.text);
    this.statusEl.ariaLabel = view.tooltip;
    this.statusEl.title = view.tooltip;
  }

  async testConnection() {
    const notice = new Notice("Vault Brain: …", 0);
    try {
      let acc = "";
      await this.provider.chatStream(
        [{ role: "user", parts: [{ type: "text", text: "Say hello in 5 words." }] }],
        {
          signal: AbortSignal.timeout(30000),
          onToken: (t) => {
            acc += t;
            notice.setMessage("Vault Brain: " + acc);
          },
        }
      );
    } catch (e) {
      notice.setMessage("Vault Brain error: " + (e as Error).message);
    } finally {
      window.setTimeout(() => notice.hide(), 4000);
    }
  }

  async activateQaView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(QA_VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: QA_VIEW_TYPE, active: true });
    }
    if (leaf) workspace.revealLeaf(leaf);
  }
}
