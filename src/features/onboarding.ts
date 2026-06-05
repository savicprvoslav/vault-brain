import { App, Modal, Notice } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { setupSteps, setupComplete, SetupState } from "../core/setup.ts";

export class OnboardingModal extends Modal {
  constructor(app: App, private plugin: VaultBrainPlugin) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Vault Brain — Setup");
    void this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async checkState(): Promise<SetupState> {
    try {
      const models = await this.plugin.provider.listModels();
      return {
        server: true,
        chatModel: models.includes(this.plugin.settings.model),
        embedModel: models.includes(this.plugin.settings.embedModel),
      };
    } catch {
      return { server: false, chatModel: false, embedModel: false };
    }
  }

  private async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "Vault Brain runs entirely on your machine via Ollama — nothing leaves your computer. Let's make sure it's ready.",
    });

    const state = await this.checkState();
    const steps = setupSteps(state, this.plugin.settings.model, this.plugin.settings.embedModel);

    for (const step of steps) {
      const row = contentEl.createDiv({ cls: "vault-brain-setup-step" });
      row.createSpan({ cls: "vault-brain-setup-icon", text: step.ok ? "✅" : "⬜" });
      row.createSpan({ cls: "vault-brain-setup-label", text: step.label });
      if (!step.ok && step.fix) {
        const fix = contentEl.createDiv({ cls: "vault-brain-setup-fix" });
        if (step.action === "link") {
          fix.createSpan({ text: step.fix + " " });
          fix.createEl("a", { text: "Download Ollama →", href: step.target ?? "https://ollama.com/download" });
        } else if (step.action === "pull" && step.target) {
          fix.createEl("code", { text: step.fix });
          const btn = fix.createEl("button", { text: "Pull now", cls: "mod-cta" });
          const prog = fix.createSpan({ cls: "vault-brain-setup-prog" });
          btn.onclick = () => void this.pull(step.target as string, btn, prog);
        }
      }
    }

    const actions = contentEl.createDiv({ cls: "vault-brain-setup-actions" });
    const recheck = actions.createEl("button", { text: "Re-check" });
    recheck.onclick = () => void this.render();

    if (setupComplete(state)) {
      const test = actions.createEl("button", { text: "Test it", cls: "mod-cta" });
      test.onclick = () => void this.test(test);
      const done = actions.createEl("button", { text: "Done" });
      done.onclick = () => {
        this.plugin.settings.onboardingDone = true;
        void this.plugin.saveSettings();
        this.close();
      };
    } else {
      contentEl.createEl("p", { cls: "vault-brain-setup-hint", text: "Fix the items above, then click Re-check." });
    }
  }

  private async pull(model: string, btn: HTMLButtonElement, prog: HTMLElement): Promise<void> {
    btn.disabled = true;
    prog.setText(" starting…");
    try {
      await this.plugin.provider.pullModel(model, (status, pct) => {
        prog.setText(` ${status}${pct ? " " + pct + "%" : ""}`);
      });
      new Notice(`Vault Brain: ${model} ready.`);
      await this.render();
    } catch (e) {
      prog.setText(" failed — " + (e as Error).message);
      btn.disabled = false;
    }
  }

  private async test(btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    btn.setText("Testing…");
    try {
      let out = "";
      await this.plugin.provider.chatStream(
        [{ role: "user", parts: [{ type: "text", text: "Say hello in 3 words." }] }],
        { signal: AbortSignal.timeout(30000), onToken: (t) => { out += t; } }
      );
      new Notice("✅ Vault Brain works — " + out.trim());
      btn.setText("✓ Working");
    } catch (e) {
      new Notice("Test failed: " + (e as Error).message);
      btn.setText("Test it");
      btn.disabled = false;
    }
  }
}

export function registerOnboarding(plugin: VaultBrainPlugin): void {
  plugin.addCommand({
    id: "setup",
    name: "Setup & health check",
    callback: () => new OnboardingModal(plugin.app, plugin).open(),
  });
}
