import { App, PluginSettingTab, Setting } from "obsidian";
import type VaultBrainPlugin from "./main.ts";

export interface VaultBrainSettings {
  host: string;
  port: number;
  model: string;
  outputTemplate: string;
  dailyNoteMode: "append" | "new";
  contextTokenCap: number;
  outputLanguage: "auto" | "en" | "sr";
  keepAlive: boolean;
}

export const DEFAULT_TEMPLATE = `## 🎙️ Voice memo — {{date}}
**Summary**
{{summary}}

**Tasks**
{{tasks}}

**Transcript**
{{transcript}}
`;

export const DEFAULT_SETTINGS: VaultBrainSettings = {
  host: "http://127.0.0.1",
  port: 11434,
  model: "gemma4:latest",
  outputTemplate: DEFAULT_TEMPLATE,
  dailyNoteMode: "append",
  contextTokenCap: 8000,
  outputLanguage: "auto",
  keepAlive: false,
};

export class VaultBrainSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: VaultBrainPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Brain — local AI" });

    const save = async () => this.plugin.saveSettings();

    new Setting(containerEl)
      .setName("Ollama host")
      .setDesc("Local endpoint only. Defaults to loopback for privacy.")
      .addText((t) =>
        t.setValue(this.plugin.settings.host).onChange(async (v) => {
          this.plugin.settings.host = v.trim();
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
      .setDesc("Periodically ping Ollama to avoid cold starts during a session.")
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
        t.inputEl.style.width = "100%";
      });
  }
}
