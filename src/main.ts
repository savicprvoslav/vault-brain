import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, VaultBrainSettings, VaultBrainSettingTab } from "./settings.ts";
import { OllamaProvider } from "./core/ollama-provider.ts";
import { checkHealth } from "./core/health.ts";
import { renderStatus } from "./core/status-bar.ts";

export default class VaultBrainPlugin extends Plugin {
  settings!: VaultBrainSettings;
  provider!: OllamaProvider;
  private statusEl!: HTMLElement;

  async onload() {
    await this.loadSettings();
    this.rebuildProvider();

    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText("⏳ Vault Brain");

    this.addSettingTab(new VaultBrainSettingTab(this.app, this));

    this.addCommand({
      id: "test-connection",
      name: "Test connection (stream a hello)",
      callback: () => this.testConnection(),
    });

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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.rebuildProvider();
    await this.refreshHealth();
  }

  async refreshHealth() {
    const state = await checkHealth(this.provider, this.settings.model);
    const view = renderStatus(state, this.settings.model);
    this.statusEl.setText(view.text);
    this.statusEl.ariaLabel = view.tooltip;
    this.statusEl.title = view.tooltip;
  }

  async testConnection() {
    const controller = new AbortController();
    const notice = new Notice("Vault Brain: …", 0);
    try {
      let acc = "";
      await this.provider.chatStream(
        [{ role: "user", parts: [{ type: "text", text: "Say hello in 5 words." }] }],
        {
          signal: controller.signal,
          onToken: (t) => {
            acc += t;
            notice.setMessage("Vault Brain: " + acc);
          },
        }
      );
      window.setTimeout(() => notice.hide(), 4000);
    } catch (e) {
      notice.hide();
      new Notice("Vault Brain error: " + (e as Error).message);
    }
  }
}
