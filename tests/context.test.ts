import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleContext } from "../src/core/context.ts";

const note = (title: string, body: string) => ({ title, body });

test("includes active note alone", () => {
  const r = assembleContext(note("A", "alpha"), [], 1000);
  assert.equal(r.included, 1);
  assert.equal(r.truncated, false);
  assert.match(r.text, /## A\nalpha/);
});

test("includes linked notes until cap", () => {
  const r = assembleContext(note("A", "alpha"), [note("B", "beta"), note("C", "gamma")], 1000);
  assert.equal(r.included, 3);
  assert.equal(r.truncated, false);
  assert.match(r.text, /## B\nbeta/);
  assert.match(r.text, /## C\ngamma/);
});

test("truncates when active note alone exceeds cap", () => {
  const r = assembleContext(note("A", "x".repeat(1000)), [], 5);
  assert.equal(r.truncated, true);
  assert.equal(r.included, 1);
});

test("omits linked notes that don't fit and flags truncation", () => {
  const big = "y".repeat(400);
  const r = assembleContext(note("A", "alpha"), [note("B", big), note("C", big)], 40);
  assert.equal(r.truncated, true);
  assert.ok(r.included < 3);
});
