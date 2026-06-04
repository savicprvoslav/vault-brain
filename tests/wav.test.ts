import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeWavPcm16 } from "../src/core/wav.ts";

function ascii(bytes: Uint8Array, off: number, len: number): string {
  return String.fromCharCode(...bytes.slice(off, off + len));
}

test("writes a valid 16-bit mono WAV header", () => {
  const pcm = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const wav = encodeWavPcm16(pcm, 16000);
  assert.equal(ascii(wav, 0, 4), "RIFF");
  assert.equal(ascii(wav, 8, 4), "WAVE");
  assert.equal(ascii(wav, 36, 4), "data");
  const view = new DataView(wav.buffer);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(wav.length, 44 + pcm.length * 2);
});

test("clamps and converts samples", () => {
  const wav = encodeWavPcm16(new Float32Array([1, -1]), 8000);
  const view = new DataView(wav.buffer);
  assert.equal(view.getInt16(44, true), 32767);
  assert.equal(view.getInt16(46, true), -32768);
});
