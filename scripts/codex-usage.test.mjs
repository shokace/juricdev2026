import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAccountUsage } from "./sync-codex-usage.mjs";
import { normalizeCodexUsage, snapshotFromSummary } from "../src/lib/codex-usage.mjs";

const summary = {
  lifetimeTokens: 2_882_303_021,
  peakDailyTokens: 373_661_828,
  longestRunningTurnSec: 5848,
  currentStreakDays: 9,
  longestStreakDays: 9,
  accessToken: "must-never-be-published",
};

test("publishes only aggregate fields, preserving totals above 32 bits", () => {
  const snapshot = snapshotFromSummary(summary);
  assert.equal(snapshot.total_tokens, 2_882_303_021);
  assert.equal(snapshot.longest_session_seconds, 5848);
  assert.deepEqual(Object.keys(snapshot).sort(), ["current_streak_days", "longest_session_seconds", "peak_daily_tokens", "total_tokens", "updated_at"]);
  assert.equal(JSON.stringify(snapshot).includes("must-never"), false);
  assert.deepEqual(normalizeCodexUsage({ ...snapshot, access_token: "secret" }), snapshot);
});

test("unavailable metrics remain null, zero usage remains zero", () => {
  const snapshot = snapshotFromSummary({ ...summary, lifetimeTokens: 0, peakDailyTokens: null, currentStreakDays: null });
  assert.equal(snapshot.total_tokens, 0);
  assert.equal(snapshot.peak_daily_tokens, null);
  assert.equal(snapshot.current_streak_days, null);
});

test("rejects invalid or absent data so it cannot replace a good snapshot", () => {
  for (const lifetimeTokens of [null, undefined, -1, 1.5, "100", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => snapshotFromSummary({ ...summary, lifetimeTokens }));
  }
  assert.throws(() => normalizeCodexUsage({ error: "upstream unavailable" }));
  assert.throws(() => snapshotFromSummary(summary, Date.now() + 120_000));
});

test("reads the account through the Codex handshake and strips private fields", async () => {
  const folder = await mkdtemp(join(tmpdir(), "codex-usage-test-"));
  try {
    const binary = join(folder, "codex-mock.mjs");
    await writeFile(binary, `#!${process.execPath}
import { createInterface } from "node:readline";
let initialized = false;
createInterface({ input: process.stdin }).on("line", line => {
  const request = JSON.parse(line);
  if (request.method === "initialize") console.log(JSON.stringify({ id: request.id, result: {} }));
  else if (request.method === "initialized") initialized = true;
  else if (request.method === "account/usage/read" && initialized) {
    console.log(JSON.stringify({ id: request.id, result: { summary: ${JSON.stringify(summary)}, dailyUsageBuckets: [{ private: true }] } }));
  } else process.exit(1);
});
`, { mode: 0o700 });
    const result = await readAccountUsage(binary);
    assert.equal(result.total_tokens, summary.lifetimeTokens);
    assert.equal("dailyUsageBuckets" in result, false);
    assert.equal("accessToken" in result, false);
    await assert.rejects(readAccountUsage(join(folder, "missing-binary")), /Codex app server stopped/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
