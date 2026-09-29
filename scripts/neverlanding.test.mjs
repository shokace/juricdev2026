import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Exercise the TypeScript source with the repository's existing compiler;
// no extra test runner or generated files are needed.
const source = await readFile(new URL("../src/lib/neverlanding.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { normalizeNeverLandingStats, createNeverLandingStatsReader } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const end = Date.parse("2026-09-29T05:32:00Z");
const start = end - 30 * 86_400_000;
const group = (date, count, sampleInterval = 1) => ({ count, avg: { sampleInterval }, dimensions: { date } });
const payload = groups => ({ data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: groups }] } } });

test("fills missing UTC days, preserves partial days, totals requests and identifies estimates", () => {
  const result = normalizeNeverLandingStats(payload([
    group("2026-09-29", 8), group("2026-08-30", 15), group("2026-09-27", 249, 7.3),
  ]), start, end, end + 500);
  assert.equal(result.points.length, 31);
  assert.deepEqual(result.points[0], { timestamp: "2026-08-30T00:00:00.000Z", requests: 15 });
  assert.deepEqual(result.points.at(-1), { timestamp: "2026-09-29T00:00:00.000Z", requests: 8 });
  assert.equal(result.points[1].requests, 0);
  assert.equal(result.requests, 272);
  assert.equal(result.estimated, true);
  assert.equal(Date.parse(result.windowEnd) - Date.parse(result.windowStart), 30 * 86_400_000);
  assert.deepEqual(Object.keys(result).sort(), ["estimated", "intervalMinutes", "points", "requests", "updatedAt", "windowEnd", "windowStart"]);
});

test("an empty successful result is zero traffic; missing, failed and malformed results are not", () => {
  const empty = normalizeNeverLandingStats(payload([]), start, end, end);
  assert.equal(empty.requests, 0);
  assert.equal(empty.estimated, false);
  assert.ok(empty.points.every(point => point.requests === 0));
  for (const invalid of [
    {}, null, { errors: [{ message: "private upstream details" }] },
    { data: { viewer: { zones: [] } } },
    payload([group("2026-09-29", -1)]), payload([group("2026-09-29", null)]),
    payload([group("2026-09-29", 1, NaN)]), payload([group("2026-09-29", Infinity)]),
    payload([group("2026-09-29", 1), group("2026-09-29", 2)]),
    payload([group("invalid", 1)]), payload([group("2026-08-29", 1)]),
    payload([group("2026-09-30", 1)]),
  ]) assert.throws(() => normalizeNeverLandingStats(invalid, start, end, end));
  const midnight = Date.parse("2026-09-29T00:00:00Z");
  assert.equal(normalizeNeverLandingStats(payload([]), midnight - 30 * 86_400_000, midnight, midnight).points.length, 30);
});

test("uses a host-filtered rolling month, caches a minute and coalesces concurrent requests", async () => {
  let clock = end + 30_000;
  let calls = 0;
  const read = createNeverLandingStatsReader({
    now: () => clock,
    credentials: () => ({ token: "private-token", zoneTag: "private-zone" }),
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, "https://api.cloudflare.com/client/v4/graphql");
      const body = JSON.parse(options.body);
      assert.match(body.query, /clientRequestHTTPHost_in: \["neverlanding.page", "www.neverlanding.page"\]/);
      assert.match(body.query, /requestSource: "eyeball"/);
      assert.equal(Date.parse(body.variables.end) - Date.parse(body.variables.start), 30 * 86_400_000);
      assert.equal(Date.parse(body.variables.end) % 60_000, 0);
      assert.equal(options.headers.Authorization, "Bearer private-token");
      return Response.json(payload([group("2026-09-29", calls)]));
    },
  });
  const [first, second] = await Promise.all([read(), read()]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first).includes("private"), false);
  clock += 59_999;
  assert.deepEqual(await read(), first);
  assert.equal(calls, 1);
  clock += 1;
  assert.equal((await read()).requests, 2);
  assert.equal(calls, 2);
});

test("upstream failures reject without publishing errors as zero or refreshing an old timestamp", async () => {
  let clock = end;
  let fail = false;
  const read = createNeverLandingStatsReader({
    now: () => clock,
    credentials: () => ({ token: "private-token", zoneTag: "private-zone" }),
    fetcher: async () => fail ? new Response("private upstream details", { status: 403 }) : Response.json(payload([group("2026-09-29", 9)])),
  });
  const first = await read();
  fail = true;
  clock += 60_000;
  await assert.rejects(read(), error => error.message === "Cloudflare analytics unavailable.");
  assert.equal(first.updatedAt, new Date(end).toISOString());
  fail = false;
  const recovered = await read();
  assert.equal(recovered.requests, 9);
  assert.equal(recovered.updatedAt, new Date(clock).toISOString());
  await assert.rejects(createNeverLandingStatsReader({ credentials: () => ({}) })());
});
