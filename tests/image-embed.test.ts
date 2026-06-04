import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImageEmbed, mimeFromExtension } from "../src/core/image-embed.ts";

test("parses wiki embed", () => {
  assert.equal(parseImageEmbed("![[diagram.png]]"), "diagram.png");
  assert.equal(parseImageEmbed("text ![[folder/shot.jpg|alt]] more"), "folder/shot.jpg");
});

test("parses markdown image", () => {
  assert.equal(parseImageEmbed("![alt](images/a.png)"), "images/a.png");
  assert.equal(parseImageEmbed("![](b%20c.jpg)"), "b c.jpg");
});

test("returns null when no embed", () => {
  assert.equal(parseImageEmbed("just text [[a note]]"), null);
});

test("mimeFromExtension maps known types, null otherwise", () => {
  assert.equal(mimeFromExtension("PNG"), "image/png");
  assert.equal(mimeFromExtension("jpg"), "image/jpeg");
  assert.equal(mimeFromExtension("jpeg"), "image/jpeg");
  assert.equal(mimeFromExtension("webp"), "image/webp");
  assert.equal(mimeFromExtension("txt"), null);
});
