import { Editor, Notice, TFile } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { parseImageEmbed, mimeFromExtension } from "../core/image-embed.ts";
import { buildVisionMessages } from "../core/vision-prompt.ts";

export function registerVisionCommand(plugin: VaultBrainPlugin): void {
  plugin.addCommand({
    id: "extract-image",
    name: "Extract text from image below cursor",
    editorCallback: (editor: Editor) => void runImageExtraction(plugin, editor),
  });
}

async function runImageExtraction(plugin: VaultBrainPlugin, editor: Editor): Promise<void> {
  const cursor = editor.getCursor();
  let embedLine = -1;
  let target: string | null = null;
  for (let line = cursor.line; line >= 0 && line >= cursor.line - 20; line--) {
    const t = parseImageEmbed(editor.getLine(line));
    if (t) {
      target = t;
      embedLine = line;
      break;
    }
  }
  if (!target) {
    new Notice("Vault Brain: no image embed found near the cursor.");
    return;
  }

  const activePath = plugin.app.workspace.getActiveFile()?.path ?? "";
  const file = plugin.app.metadataCache.getFirstLinkpathDest(target, activePath);
  if (!(file instanceof TFile)) {
    new Notice(`Vault Brain: couldn't resolve image "${target}".`);
    return;
  }
  const mime = mimeFromExtension(file.extension);
  if (!mime) {
    new Notice(`Vault Brain: ".${file.extension}" is not a supported image type.`);
    return;
  }

  const bytes = await plugin.app.vault.readBinary(file);
  const b64 = Buffer.from(new Uint8Array(bytes)).toString("base64");
  const messages = buildVisionMessages(mime, b64);

  const notice = new Notice("Vault Brain: extracting text from image…", 0);
  let out = "";
  try {
    await plugin.activity.run("Extracting image text", () =>
      plugin.provider.chatStream(messages, {
        signal: AbortSignal.timeout(600000),
        onThinking: () => notice.setMessage("Vault Brain: reading image — thinking…"),
        onToken: (t) => { out += t; },
      })
    );
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
    return;
  }
  notice.hide();

  const text = out.trim();
  if (!text || text === "(no text found)") {
    new Notice("Vault Brain: no text could be extracted from that image.");
    return;
  }

  // Insert directly below the image embed line (which may be above the cursor if the command
  // was run from further down the note). Per spec, the extracted text goes below the embed.
  const endOfEmbed = { line: embedLine, ch: editor.getLine(embedLine).length };
  editor.replaceRange(`\n\n${text}\n`, endOfEmbed);
  new Notice("Vault Brain: image text inserted.");
}
