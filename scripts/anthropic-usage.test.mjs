import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAnthropicUsage, summarizeAnthropicCost } from "../src/lib/anthropic-usage.mjs";
test("sums all token types and merges daily buckets without exposing report identifiers", () => {
 const row = { uncached_input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation: { ephemeral_5m_input_tokens: 40, ephemeral_1h_input_tokens: 50 }, workspace_id: "private", api_key_id: "private" };
 const result = summarizeAnthropicUsage([{ starting_at: "2026-09-15T00:00:00Z", results: [row] }, { starting_at: "2026-09-15T01:00:00Z", results: [row] }], 123, "2026-01-01");
 assert.equal(result.total_tokens, 300); assert.equal(result.cached_creation_tokens, 180);
 assert.deepEqual(result.daily_usage, [{ date: "2026-09-15", tokens: 300 }]);
 assert.equal(JSON.stringify(result).includes("private"), false);
 assert.equal(summarizeAnthropicUsage([], 123, "2026-01-01").total_tokens, 0);
});
test("cost uses actual USD cents, not assumed model prices", () => {
 assert.equal(summarizeAnthropicCost([{ results: [{ currency: "USD", amount: "123.45" }, { currency: "USD", amount: "76.55" }] }]), 2);
 assert.throws(() => summarizeAnthropicCost([{ results: [{ currency: "USD", amount: "NaN" }] }]));
 assert.throws(() => summarizeAnthropicUsage([{ starting_at: "2026-09-15", results: [{ output_tokens: -1 }] }], 123, "2026-01-01"));
});
test("persisted snapshots are validated and private fields are discarded", async () => {
 const { normalizeAnthropicSnapshot } = await import("../src/lib/anthropic-usage.mjs");
 const snapshot = { ...summarizeAnthropicUsage([], Date.now(), "2026-02-01"), secret: "private", stale: true };
 assert.equal("secret" in normalizeAnthropicSnapshot(snapshot), false);
 assert.equal("stale" in normalizeAnthropicSnapshot(snapshot), false);
 assert.throws(() => normalizeAnthropicSnapshot({ ...snapshot, total_tokens: -1 }));
 assert.throws(() => normalizeAnthropicSnapshot({ ...snapshot, since: "2026-02-31" }));
 assert.throws(() => normalizeAnthropicSnapshot({ ...snapshot, updated_at: Date.now()+120_000 }));
});
