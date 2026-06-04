import { test } from "node:test";
import assert from "node:assert/strict";
import { estimate, truncateToBudget } from "../src/core/tokens.ts";

test("estimate ~4 chars per token", () => {
  assert.equal(estimate(""), 0);
  assert.equal(estimate("abcd"), 1);
  assert.equal(estimate("abcde"), 2);
});

test("truncateToBudget leaves short text alone", () => {
  const r = truncateToBudget("hello", 100);
  assert.equal(r.text, "hello");
  assert.equal(r.truncated, false);
});

test("truncateToBudget cuts long text and flags it", () => {
  const long = "x".repeat(100);
  const r = truncateToBudget(long, 5);
  assert.equal(r.truncated, true);
  assert.equal(r.text.length, 20);
});
