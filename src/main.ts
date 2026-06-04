import { Plugin } from "obsidian";

export default class VaultBrainPlugin extends Plugin {
  async onload() {
    console.log("Vault Brain loaded");
  }
  onunload() {
    console.log("Vault Brain unloaded");
  }
}
