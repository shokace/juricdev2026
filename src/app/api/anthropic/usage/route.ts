import { after, NextResponse } from "next/server";
import { ANTHROPIC_USAGE_KEY, normalizeAnthropicSnapshot, summarizeAnthropicCost, summarizeAnthropicUsage } from "@/lib/anthropic-usage.mjs";
import { createAnthropicUsageCache } from "@/lib/anthropic-usage-cache.mjs";

export const runtime = "edge";
export const dynamic = "force-dynamic";
type Summary = Omit<ReturnType<typeof summarizeAnthropicUsage>, "total_cost_usd"> & { total_cost_usd: number | null };

function storage() {
  const token = process.env.KVTok ?? process.env.CLOUDFLARE_KV_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID_CODEX ?? process.env.CLOUDFLARE_KV_NAMESPACE_ID_ISS;
  if (!token || !account || !namespace) return null;
  return { url: `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/${encodeURIComponent(ANTHROPIC_USAGE_KEY)}`, headers: { Authorization: `Bearer ${token}` } };
}

async function readSaved(): Promise<Summary | null> {
  const kv = storage();
  if (!kv) return null;
  try {
    const response = await fetch(kv.url, { headers: kv.headers, cache: "no-store", signal: AbortSignal.timeout(3000) });
    return response.ok ? normalizeAnthropicSnapshot(await response.json()) : null;
  } catch { return null; }
}

async function saveSummary(summary: Summary) {
  const kv = storage();
  if (!kv) return;
  // Keep the last good public snapshot across cold starts and upstream rate limits.
  await fetch(kv.url, { method: "PUT", headers: { ...kv.headers, "Content-Type": "application/json" }, body: JSON.stringify(summary), signal: AbortSignal.timeout(3000) }).catch(() => null);
}

async function report(path: string, key: string, start: string, end: string, signal: AbortSignal) {
  const buckets = [];
  const seen = new Set<string>();
  let page: string | null = null;
  for (let n = 0; n < 120; n++) {
    const params = new URLSearchParams({ starting_at: start, ending_at: end, bucket_width: "1d", limit: "31" });
    if (page) params.set("page", page);
    const response = await fetch(`https://api.anthropic.com/v1/organizations/${path}?${params}`, {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "User-Agent": "JuricPortfolio/1.0 (https://juric.dev)" },
      signal, cache: "no-store",
    });
    if (!response.ok) throw new Error("Anthropic report unavailable");
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error("Invalid report");
    buckets.push(...payload.data);
    if (!payload.has_more) return buckets;
    if (typeof payload.next_page !== "string" || !payload.next_page || seen.has(payload.next_page)) throw new Error("Invalid pagination");
    page = payload.next_page;
    seen.add(payload.next_page);
  }
  throw new Error("Report exceeds page limit");
}

async function refreshSummary(): Promise<Summary> {
  const now = Date.now();
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  const date = Date.parse(process.env.ANTHROPIC_USAGE_START_DATE ?? "");
  if (!key || !Number.isFinite(date) || date >= now) throw new Error("Anthropic usage is not configured.");
  const start = new Date(date).toISOString(), end = new Date(now).toISOString();
  const signal = AbortSignal.timeout(18_000);
  const [usage, cost] = await Promise.all([
    report("usage_report/messages", key, start, end, signal),
    report("cost_report", key, start, end, signal).then(summarizeAnthropicCost).catch(() => null),
  ]);
  return { ...summarizeAnthropicUsage(usage, now, start.slice(0, 10)), total_cost_usd: cost };
}

const getUsage = createAnthropicUsageCache({ readSaved, refresh: refreshSummary, saveSummary });

export async function GET() {
  const result = await getUsage((task: Promise<unknown>) => after(task));
  if (!result) {
    return NextResponse.json({ error: "Anthropic usage is temporarily unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json({ ...result.summary, stale: result.stale }, {
    // Short caching lets clients pick up the completed background refresh promptly.
    headers: { "Cache-Control": `public, max-age=${result.stale ? 0 : 60}, s-maxage=60` },
  });
}
