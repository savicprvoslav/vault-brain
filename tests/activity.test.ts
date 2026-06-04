import { test } from "node:test";
import assert from "node:assert/strict";
import { Activity, renderActivity } from "../src/core/activity.ts";

test("start/end tracks running count", () => {
  const a = new Activity();
  const id = a.start("x");
  assert.equal(a.runningCount(), 1);
  a.end(id, "done");
  assert.equal(a.runningCount(), 0);
});
test("run resolves and records done", async () => {
  const a = new Activity();
  const r = await a.run("x", async () => 42);
  assert.equal(r, 42);
  assert.equal(a.runningCount(), 0);
  assert.equal(a.recent()[0].status, "done");
});
test("run records error and rethrows", async () => {
  const a = new Activity();
  await assert.rejects(() => a.run("x", async () => { throw new Error("boom"); }));
  assert.equal(a.runningCount(), 0);
  assert.equal(a.recent()[0].status, "error");
});
test("renderActivity idle / one / many", () => {
  assert.match(renderActivity(0, null).text, /🧠/);
  assert.match(renderActivity(1, "Transcribing").text, /Transcribing…/);
  assert.match(renderActivity(3, "x").text, /3 running/);
});
test("onChange fires on start and end", () => {
  const a = new Activity();
  let fired = 0;
  a.onChange(() => fired++);
  const id = a.start("x");
  a.end(id);
  assert.ok(fired >= 2);
});
