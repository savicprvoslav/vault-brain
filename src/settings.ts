import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type VaultBrainPlugin from "./main.ts";
import { OnboardingModal } from "./features/onboarding.ts";

export class VaultBrainSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: VaultBrainPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Vault Brain — local AI").setHeading();

    new Setting(containerEl)
      .setName("Setup & health check")
      .setDesc("Re-run the guided setup — verify Ollama and pull missing models.")
      .addButton((b) => b.setButtonText("Open setup").onClick(() => new OnboardingModal(this.app, this.plugin).open()));

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
      .setName("Embedding model")
      .setDesc("Local model used to index your vault for whole-vault search.")
      .addText((t) =>
        t.setValue(this.plugin.settings.embedModel).onChange(async (v) => {
          this.plugin.settings.embedModel = v.trim();
          await save();
        })
      );

    new Setting(containerEl)
      .setName("Vault search results (top-K)")
      .setDesc("How many note chunks to retrieve for a whole-vault question.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.ragTopK)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isInteger(n) && n >= 1) {
            this.plugin.settings.ragTopK = n;
            await save();
          }
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
      .setName("Microphone")
      .setDesc("Device used for in-app recording. Device names appear after you grant mic access once.")
      .addDropdown(async (d) => {
        d.addOption("", "System default");
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          devices
            .filter((dev) => dev.kind === "audioinput")
            .forEach((dev, i) => d.addOption(dev.deviceId, dev.label || `Microphone ${i + 1}`));
        } catch {
          /* enumeration may fail before permission is granted */
        }
        d.setValue(this.plugin.settings.micDeviceId);
        d.onChange(async (v) => {
          this.plugin.settings.micDeviceId = v;
          await save();
        });
      });

    new Setting(containerEl)
      .setName("Auto-watch folder for audio")
      .setDesc("New audio files dropped into this vault folder are transcribed automatically. Leave blank to disable.")
      .addText((t) =>
        t.setPlaceholder("e.g. Recordings").setValue(this.plugin.settings.watchFolder).onChange(async (v) => {
          this.plugin.settings.watchFolder = v.trim();
          await save();
        })
      );

    new Setting(containerEl)
      .setName("PDF max pages")
      .setDesc("How many pages to OCR when extracting text from a PDF.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.pdfMaxPages)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isInteger(n) && n >= 1) {
            this.plugin.settings.pdfMaxPages = n;
            await save();
          }
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
        t.inputEl.addClass("vault-brain-template");
      });

    new Setting(containerEl)
      .setName("Custom prompts")
      .setDesc('One per line as "Name :: instruction". They appear in the right-click → Vault Brain submenu on a selection.')
      .addTextArea((t) => {
        t.setValue(this.plugin.settings.customPrompts).onChange(async (v) => {
          this.plugin.settings.customPrompts = v;
          await save();
        });
        t.inputEl.rows = 4;
        t.inputEl.addClass("vault-brain-template");
      });
  }
}
