import { Menu, Notice, TAbstractFile, TFile, normalizePath } from "obsidian";
import type VaultBrainPlugin from "../main.ts";
import { buildVisionMessages } from "../core/vision-prompt.ts";

interface PdfPage {
  getViewport(opts: { scale: number }): { width: number; height: number };
  render(opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
interface PdfJsLib {
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDoc> };
}

export function registerPdfCommand(plugin: VaultBrainPlugin): void {
  plugin.registerEvent(
    plugin.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
      if (file instanceof TFile && file.extension === "pdf") {
        menu.addItem((item) =>
          item
            .setTitle("Vault Brain: Extract text (vision OCR)")
            .setIcon("scan-text")
            .onClick(() => void extractPdf(plugin, file))
        );
      }
    })
  );
}

async function extractPdf(plugin: VaultBrainPlugin, file: TFile): Promise<void> {
  const pdfjsLib = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
  if (!pdfjsLib?.getDocument) {
    new Notice("Vault Brain: PDF engine not ready — open any PDF in Obsidian once, then try again.");
    return;
  }
  const notice = new Notice(`Vault Brain: reading ${file.name}…`, 0);
  try {
    const data = await plugin.app.vault.readBinary(file);
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const maxPages = Math.min(pdf.numPages, Math.max(1, plugin.settings.pdfMaxPages));
    let out = `# ${file.basename} — extracted text\n`;
    for (let i = 1; i <= maxPages; i++) {
      notice.setMessage(`Vault Brain: OCR page ${i}/${maxPages}…`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const b64 = canvas.toDataURL("image/png").split(",")[1] ?? "";
      let pageText = "";
      await plugin.activity.run(`PDF OCR ${i}/${maxPages}`, () =>
        plugin.provider.chatStream(buildVisionMessages("image/png", b64), {
          signal: AbortSignal.timeout(180000),
          onToken: (t) => { pageText += t; },
        })
      );
      out += `\n\n## Page ${i}\n\n${pageText.trim()}`;
    }
    if (pdf.numPages > maxPages) {
      out += `\n\n_(${pdf.numPages - maxPages} more page(s) not processed — raise "PDF max pages" in settings.)_`;
    }
    const dir = file.parent && file.parent.path !== "/" ? file.parent.path + "/" : "";
    const path = normalizePath(`${dir}${file.basename} (extracted).md`);
    const existing = plugin.app.vault.getAbstractFileByPath(path);
    const target = existing instanceof TFile ? existing : await plugin.app.vault.create(path, "");
    await plugin.app.vault.modify(target, out);
    notice.hide();
    await plugin.app.workspace.getLeaf(true).openFile(target);
    new Notice(`Vault Brain: extracted ${maxPages} page(s) → "${target.basename}"`);
  } catch (e) {
    notice.hide();
    new Notice("Vault Brain error: " + (e as Error).message);
  }
}
