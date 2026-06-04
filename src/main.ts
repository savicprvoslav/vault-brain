import { Menu, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { normalizeSettings, VaultBrainSettings } from "./core/settings-model.ts";
import { VaultBrainSettingTab } from "./settings.ts";
import { OllamaProvider } from "./core/ollama-provider.ts";
import { checkHealth } from "./core/health.ts";
import { renderStatus, StatusView } from "./core/status-bar.ts";
import { VaultBrainQaView, QA_VIEW_TYPE } from "./features/qa-view.ts";
import { RelatedNotesView, RELATED_VIEW_TYPE } from "./features/related-view.ts";
import { registerVisionCommand } from "./features/vision.ts";
import { registerVoiceCommands } from "./features/voice.ts";
import { registerRecorder } from "./features/recorder.ts";
import { registerQuickActions } from "./features/actions.ts";
import { registerOrganizeCommands } from "./features/organize.ts";
import { registerContinueCommand } from "./features/continue.ts";
import { VaultIndex } from "./features/vault-index.ts";
import { Activity, renderActivity } from "./core/activity.ts";

export default class VaultBrainPlugin extends Plugin {
  settings!: VaultBrainSettings;
  provider!: OllamaProvider;
  vaultIndex!: VaultIndex;
  activity = new Activity();
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

    this.registerView(RELATED_VIEW_TYPE, (leaf) => new RelatedNotesView(leaf, this));
    this.addRibbonIcon("git-fork", "Vault Brain: related notes", () => void this.activateLeafView(RELATED_VIEW_TYPE));
    this.addCommand({ id: "open-related", name: "Open related notes", callback: () => void this.activateLeafView(RELATED_VIEW_TYPE) });

    registerVisionCommand(this);
    registerVoiceCommands(this);
    registerRecorder(this);
    registerQuickActions(this);
    registerOrganizeCommands(this);
    registerContinueCommand(this);

    this.vaultIndex = new VaultIndex(this);
    this.app.workspace.onLayoutReady(() => {
      void (async () => {
        await this.vaultIndex.load();
        await this.vaultIndex.reconcile();
      })();
    });
    this.registerEvent(this.app.vault.on("modify", (f) => {
      if (f instanceof TFile && f.extension === "md") void this.vaultIndex.updateFile(f);
    }));
    this.registerEvent(this.app.vault.on("create", (f) => {
      if (f instanceof TFile && f.extension === "md") void this.vaultIndex.updateFile(f);
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => this.vaultIndex.removeFile(f.path)));
    this.registerEvent(this.app.vault.on("rename", (f, oldPath) => {
      this.vaultIndex.removeFile(oldPath);
      if (f instanceof TFile && f.extension === "md") void this.vaultIndex.updateFile(f);
    }));
    this.addCommand({
      id: "rebuild-index",
      name: "Rebuild vault index",
      callback: async () => {
        const n = new Notice("Vault Brain: rebuilding vault index…", 0);
        try {
          const count = await this.vaultIndex.reindexAll();
          n.hide();
          new Notice(`Vault Brain: indexed ${count} notes.`);
        } catch (e) {
          n.hide();
          new Notice("Vault Brain error: " + (e as Error).message);
        }
      },
    });

    const activityEl = this.addStatusBarItem();
    const updateActivity = () => {
      const v = renderActivity(this.activity.runningCount(), this.activity.current()?.label ?? null);
      activityEl.setText(v.text);
      activityEl.ariaLabel = v.tooltip;
      activityEl.title = v.tooltip;
    };
    this.activity.onChange(updateActivity);
    updateActivity();
    activityEl.style.cursor = "pointer";
    activityEl.addEventListener("click", (e) => {
      const menu = new Menu();
      const recent = this.activity.recent();
      if (recent.length === 0) {
        menu.addItem((i) => i.setTitle("No recent activity").setDisabled(true));
      } else {
        for (const a of recent) {
          const icon = a.status === "running" ? "⏳" : a.status === "error" ? "⚠️" : "✓";
          menu.addItem((i) => i.setTitle(`${icon} ${a.label}`));
        }
      }
      menu.showAtMouseEvent(e);
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
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: QA_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async activateLeafView(viewType: string): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(viewType)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: viewType, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}
