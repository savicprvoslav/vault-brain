import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type VaultBrainPlugin from "./main.ts";

export class VaultBrainSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: VaultBrainPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Vault Brain — local AI").setHeading();

    const save = async () => this.plugin.saveSettings();

    new Setting(containerEl)
      .setName("Ollama host")
      .setDesc("Local endpoint only. Defaults to loopback for privacy.")
      .addText((t) =>
        t.setValue(this.plugin.settings.host).onChange(async (v) => {
          const host = v.trim();
          this.plugin.settings.host = host;
          if (!/^https?:\/\/(localhost|127\.|\[?::1\]?)/i.test(host)) {
            new Notice("Vault Brain: non-local host set — your notes would leave this machine. Use a localhost address to keep everything private.");
          }
          await save();
        })
      );

    new Setting(containerEl).setName("Ollama port").addText((t) =>
      t.setValue(String(this.plugin.settings.port)).onChange(async (v) => {
        const n = Number(v);
        if (!Number.isNaN(n)) {
          this.plugin.settings.port = n;
          await save();
        }
      })
    );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("gemma4:latest (8B) supports audio + vision. The text-only gemma4:12b-mlx may be used once multimodal features are not needed.")
      .addText((t) =>
        t.setValue(this.plugin.settings.model).onChange(async (v) => {
          this.plugin.settings.model = v.trim();
          await save();
        })
      );

    new Setting(containerEl)
      .setName("Daily-note mode")
      .setDesc("Where processed voice memos go.")
      .addDropdown((d) =>
        d
          .addOption("append", "Append to today's daily note")
          .addOption("new", "New note per memo")
          .setValue(this.plugin.settings.dailyNoteMode)
          .onChange(async (v) => {
            this.plugin.settings.dailyNoteMode = v as "append" | "new";
            await save();
          })
      );

    new Setting(containerEl)
      .setName("Output language")
      .addDropdown((d) =>
        d
          .addOption("auto", "Auto (match input)")
          .addOption("en", "English")
          .addOption("sr", "Serbian")
          .setValue(this.plugin.settings.outputLanguage)
          .onChange(async (v) => {
            this.plugin.settings.outputLanguage = v as "auto" | "en" | "sr";
            await save();
          })
      );

    new Setting(containerEl)
      .setName("Context token cap")
      .setDesc("Hard cap on Q&A context size.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.contextTokenCap)).onChange(async (v) => {
          const n = Number(v);
          if (!Number.isNaN(n) && n > 0) {
            this.plugin.settings.contextTokenCap = n;
            await save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Keep model warm")
      .setDesc("Periodically ping Ollama to avoid cold starts during a session. (coming soon)")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.keepAlive).onChange(async (v) => {
          this.plugin.settings.keepAlive = v;
          await save();
        })
      );

    new Setting(containerEl)
      .setName("Output template")
      .setDesc("Placeholders: {{date}} {{title}} {{summary}} {{tasks}} {{transcript}}")
      .addTextArea((t) => {
        t.setValue(this.plugin.settings.outputTemplate).onChange(async (v) => {
          this.plugin.settings.outputTemplate = v;
          await save();
        });
        t.inputEl.rows = 10;
        t.inputEl.addClass("vault-brain-template");
      });
  }
}
