import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine, topK, averageVectors } from "../src/core/similarity.ts";

test("cosine: identical=1, orthogonal=0, opposite=-1", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([1, 0], [-1, 0]), -1);
});
test("cosine handles zero vectors", () => { assert.equal(cosine([0, 0], [1, 1]), 0); });
test("topK returns k highest by score, sorted", () => {
  const items = [
    { vector: [1, 0], value: "a" },
    { vector: [0, 1], value: "b" },
    { vector: [0.9, 0.1], value: "c" },
  ];
  const r = topK([1, 0], items, 2);
  assert.equal(r.length, 2);
  assert.equal(r[0].value, "a");
  assert.equal(r[1].value, "c");
});
test("averageVectors averages componentwise", () => {
  assert.deepEqual(averageVectors([[2, 0], [0, 2]]), [1, 1]);
  assert.deepEqual(averageVectors([]), []);
});
