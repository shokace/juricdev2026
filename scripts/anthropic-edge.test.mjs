// Run after next-on-pages builds .vercel/output/static. Exercise the actual
// deployment bundle with slow upstream responses, without contacting any service.
import assert from "node:assert/strict";
import { register } from "node:module";
import { summarizeAnthropicUsage } from "../src/lib/anthropic-usage.mjs";

// Node needs the same module names and ESM format that workerd provides.
const workerRoot = new URL("../.vercel/output/static/_worker.js/", import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    const root = ${JSON.stringify(workerRoot)};
    if (specifier.startsWith('__next-on-pages-dist__/')) {
      return { url: new URL(specifier, root).href, format: 'module', shortCircuit: true };
    }
    const result = await next(specifier, context);
    return result.url.startsWith(root) ? { ...result, format: 'module' } : result;
  }
`)}`, import.meta.url);

const originalProcess = globalThis.process;
const originalFetch = globalThis.fetch;
const tasks = [];
const requests = [];
let release;
const upstream = new Promise(resolve => { release = resolve; });
let saved = summarizeAnthropicUsage([], Date.now() - 7_200_000, "2026-01-01");
let writes = 0;

globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  requests.push(request.url);
  if (url.hostname === "api.cloudflare.com") {
    if (request.method === "PUT") {
      saved = JSON.parse(await request.text());
      writes++;
      return Response.json({ success: true });
    }
    return Response.json(saved);
  }
  assert.equal(url.hostname, "api.anthropic.com", "Unexpected external request");
  await upstream;
  return Response.json({ has_more: false, data: [{
    starting_at: "2026-01-01T00:00:00Z",
    results: url.pathname.endsWith("cost_report")
      ? [{ currency: "USD", amount: "123" }]
      : [{ uncached_input_tokens: 100, output_tokens: 200 }],
  }] });
};

try {
  const { default: worker } = await import("../.vercel/output/static/_worker.js/index.js");
  const env = {
    KVTok: "test-only", CLOUDFLARE_ACCOUNT_ID: "test-account",
    CLOUDFLARE_KV_NAMESPACE_ID_ISS: "test-namespace",
    ANTHROPIC_ADMIN_KEY: "test-only", ANTHROPIC_USAGE_START_DATE: "2026-01-01",
  };
  const ctx = { waitUntil: task => tasks.push(task), passThroughOnException() {} };
  const request = () => worker.fetch(new Request("https://example.test/api/anthropic/usage"), env, ctx);
  let timer;
  const response = await Promise.race([
    request(),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Edge response blocked on refresh")), 1000); }),
  ]).finally(() => clearTimeout(timer));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).stale, true);
  assert.match(response.headers.get("Cache-Control"), /max-age=0/);
  assert.ok(tasks.length, "Background work must be attached to Cloudflare waitUntil");
  release();
  await Promise.all(tasks);
  assert.equal(writes, 1, "Background refresh must finish and persist after response");
  assert.equal(saved.total_tokens, 300);
  assert.equal(saved.total_cost_usd, 1.23);
  const fresh = await request();
  const body = await fresh.json();
  assert.equal(body.stale, false);
  assert.equal(body.total_tokens, 300);
  assert.equal(requests.filter(url => url.includes("api.anthropic.com")).length, 2);
  console.log("PASS: deployed edge bundle serves stale data immediately, completes background refresh and persists it");
} finally {
  release();
  globalThis.process = originalProcess;
  globalThis.fetch = originalFetch;
}
