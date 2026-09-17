import assert from "node:assert/strict";
import test from "node:test";
import { parseIssSnapshot, normalizeIssTrail, mergeIssTrail } from "../src/lib/iss-data.mjs";
const now = Date.parse("2026-09-17T00:00:00Z");
const payload = { message: "success", timestamp: now / 1000, iss_position: { latitude: "0", longitude: "0" } };
test("accepts equator/prime meridian and marks old cached positions stale", () => {
  assert.equal(parseIssSnapshot(payload, [], now).ok, true);
  assert.equal(parseIssSnapshot(payload, [], now).latitude, "0.0000");
  assert.equal(parseIssSnapshot(payload, [], now + 46_000).ok, false);
});
test("rejects malformed coordinates, errors and impossible timestamps", () => {
  for (const latitude of [null, "", "NaN", Infinity, 91, -91, true]) assert.throws(() => parseIssSnapshot({...payload, iss_position: {latitude, longitude: 0}}, [], now));
  for (const longitude of [null, "", "NaN", Infinity, 181, -181, false]) assert.throws(() => parseIssSnapshot({...payload, iss_position: {latitude: 0, longitude}}, [], now));
  assert.throws(() => parseIssSnapshot({...payload, message: "error"}, [], now));
  assert.throws(() => parseIssSnapshot({...payload, timestamp: now/1000+90}, [], now));
});
test("retains trail on position-only updates and filters invalid/private trail fields", () => {
  const trail = [{lat: 30, lon: 90, ts: now, secret: "private"}, {lat: NaN, lon: 90, ts: now}, {lat: 20, lon: 200, ts: now}];
  assert.deepEqual(normalizeIssTrail(trail), [{lat: 30, lon: 90, ts: now}]);
  const prior = [{lat: 10, lon: 10, ts: now-1000}];
  assert.deepEqual(parseIssSnapshot(payload, prior, now).trail, prior);
  assert.deepEqual(mergeIssTrail(prior, [...prior, {lat: 20, lon: 20, ts: now}]), [...prior, {lat: 20, lon: 20, ts: now}]);
});
