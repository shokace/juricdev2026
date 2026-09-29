import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAnthropicUsage, summarizeAnthropicCost } from "../src/lib/anthropic-usage.mjs";
import { createAnthropicUsageCache, ANTHROPIC_USAGE_TTL } from "../src/lib/anthropic-usage-cache.mjs";
test("sums all token types and merges daily buckets without exposing report identifiers", () => {
 const row = { uncached_input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation: { ephemeral_5m_input_tokens: 40, ephemeral_1h_input_tokens: 50 }, workspace_id: "private", api_key_id: "private" };
 const result = summarizeAnthropicUsage([{ starting_at: "2026-09-15T00:00:00Z", results: [row] }, { starting_at: "2026-09-15T01:00:00Z", results: [row] }], 123, "2026-01-01");
 assert.equal(result.total_tokens, 300); assert.equal(result.cached_creation_tokens, 180);
 assert.deepEqual(result.daily_usage, [{ date: "2026-09-15", tokens: 300 }]);
 assert.equal(JSON.stringify(result).includes("private"), false);
 assert.equal(summarizeAnthropicUsage([], 123, "2026-01-01").total_tokens, 0);
});

const deferred = () => {
 let resolve, reject;
 const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
 return { promise, resolve, reject };
};
const snapshot = updatedAt => summarizeAnthropicUsage([], updatedAt, "2026-01-01");
const immediate = promise => Promise.race([
 promise,
 new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("Cached response blocked on refresh")), 100); timer.unref(); }),
]);

test("cold start serves expired KV immediately and persists the background refresh", async () => {
 const now = Date.now(), old = snapshot(now - 2 * ANTHROPIC_USAGE_TTL), fresh = snapshot(now);
 const upstream = deferred(), storage = deferred(), tasks = [];
 let requests = 0, reads = 0, saved;
 const get = createAnthropicUsageCache({ now: () => now,
  readSaved: async () => { reads++; return old; },
  refresh: () => { requests++; return upstream.promise; },
  saveSummary: value => { saved = value; return storage.promise; },
 });
 const defer = task => tasks.push(task);
 const results = await immediate(Promise.all([get(defer), get(defer), get(defer)]));
 assert.ok(results.every(result => result.summary === old && result.stale));
 assert.equal(reads, 1);
 assert.equal(requests, 1);
 assert.equal(tasks.length, 1, "refresh is registered with the request lifetime");
 upstream.resolve(fresh);
 await upstream.promise;
 await Promise.resolve();
 assert.deepEqual(await immediate(get(defer)), { summary: fresh, stale: false });
 assert.equal(saved, fresh);
 storage.resolve();
 await Promise.all(tasks);
 // A different edge instance must reuse the persisted report, not fetch history.
 const cold = createAnthropicUsageCache({ now: () => now,
  readSaved: async () => saved, refresh: () => assert.fail("Fresh KV must skip Anthropic"), saveSummary: async () => {},
 });
 assert.deepEqual(await cold(defer), { summary: fresh, stale: false });
});

test("an expired in-memory report does not wait for KV and reuses another instance's fresh snapshot", async () => {
 let now = Date.now(), reads = 0;
 const old = snapshot(now), kv = deferred(), tasks = [];
 const get = createAnthropicUsageCache({ now: () => now,
  readSaved: () => ++reads === 1 ? old : kv.promise,
  refresh: () => assert.fail("Fresh shared report must skip Anthropic"), saveSummary: async () => {},
 });
 const defer = task => tasks.push(task);
 assert.equal((await get(defer)).stale, false);
 now += ANTHROPIC_USAGE_TTL;
 assert.deepEqual(await immediate(get(defer)), { summary: old, stale: true });
 const fresh = snapshot(now);
 kv.resolve(fresh);
 await Promise.all(tasks);
 assert.deepEqual(await get(defer), { summary: fresh, stale: false });
});

test("failed refresh keeps old data, backs off, and recovers on retry", async () => {
 let now = Date.now(), requests = 0, saved;
 const old = snapshot(now - 2 * ANTHROPIC_USAGE_TTL), tasks = [];
 const get = createAnthropicUsageCache({ now: () => now, readSaved: async () => old,
  refresh: async () => { if (++requests === 1) throw new Error("rate limited"); return snapshot(now); },
  saveSummary: async value => { saved = value; },
 });
 const defer = task => tasks.push(task);
 assert.deepEqual(await get(defer), { summary: old, stale: true });
 await Promise.all(tasks);
 assert.deepEqual(await get(defer), { summary: old, stale: true });
 assert.equal(requests, 1);
 assert.equal(saved, undefined, "failed reports must never overwrite KV");
 now += 60_000;
 await get(defer);
 await Promise.all(tasks);
 assert.deepEqual(await get(defer), { summary: saved, stale: false });
 assert.equal(requests, 2);
});

test("a true cache miss fetches once and returns before a slow KV write", async () => {
 const now = Date.now(), fresh = snapshot(now), tasks = [], write = deferred();
 let requests = 0;
 const get = createAnthropicUsageCache({ now: () => now, readSaved: async () => null,
  refresh: async () => { requests++; return fresh; }, saveSummary: () => write.promise,
 });
 const results = await immediate(Promise.all([get(task => tasks.push(task)), get(task => tasks.push(task))]));
 assert.ok(results.every(result => result.summary === fresh && !result.stale));
 assert.equal(requests, 1);
 write.resolve();
 await Promise.all(tasks);
});

test("missing or corrupt KV still refreshes; persistence failure retains in-memory data", async () => {
 const now = Date.now(), fresh = snapshot(now), tasks = [];
 const get = createAnthropicUsageCache({ now: () => now,
  readSaved: async () => { throw new Error("Invalid snapshot"); },
  refresh: async () => fresh, saveSummary: async () => { throw new Error("KV down"); },
 });
 const defer = task => tasks.push(task);
 assert.deepEqual(await get(defer), { summary: fresh, stale: false });
 await Promise.all(tasks);
 assert.deepEqual(await get(defer), { summary: fresh, stale: false });
});

test("an unavailable first report returns no fabricated totals and can retry", async () => {
 let now = Date.now(), requests = 0;
 const tasks = [];
 const get = createAnthropicUsageCache({ now: () => now, readSaved: async () => null,
  refresh: async () => { requests++; throw new Error("Unavailable"); }, saveSummary: () => assert.fail("No failed writes"),
 });
 const defer = task => tasks.push(task);
 assert.equal(await get(defer), null);
 await Promise.all(tasks);
 assert.equal(await get(defer), null);
 assert.equal(requests, 1);
 now += 60_000;
 assert.equal(await get(defer), null);
 await Promise.all(tasks);
 assert.equal(requests, 2);
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
