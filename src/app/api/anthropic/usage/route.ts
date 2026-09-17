import { NextResponse } from "next/server";
import { summarizeAnthropicCost, summarizeAnthropicUsage } from "@/lib/anthropic-usage.mjs";

export const runtime = "edge";
export const dynamic = "force-dynamic";
type Summary = Omit<ReturnType<typeof summarizeAnthropicUsage>, "total_cost_usd"> & { total_cost_usd: number | null };
let cached: Summary | null = null;
let pending: Promise<Summary> | null = null;
const TTL = 60 * 60 * 1000;

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

export async function GET() {
  const now = Date.now();
  const reply = (summary: Summary, stale = false) => NextResponse.json({ ...summary, stale }, {
    headers: { "Cache-Control": `public, max-age=60, s-maxage=${stale ? 60 : 3600}` },
  });
  if (cached && now - cached.updated_at < TTL) return reply(cached);
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  const date = Date.parse(process.env.ANTHROPIC_USAGE_START_DATE ?? "");
  if (!key || !Number.isFinite(date) || date >= now) {
    return NextResponse.json({ error: "Anthropic usage is not configured." }, { status: 503 });
  }
  try {
    if (!pending) pending = (async () => {
      const start = new Date(date).toISOString(), end = new Date(now).toISOString();
      const signal = AbortSignal.timeout(25_000);
      const [usage, cost] = await Promise.all([
        report("usage_report/messages", key, start, end, signal),
        report("cost_report", key, start, end, signal).then(summarizeAnthropicCost).catch(() => null),
      ]);
      return { ...summarizeAnthropicUsage(usage, now, start.slice(0, 10)), total_cost_usd: cost };
    })().finally(() => { pending = null; });
    cached = await pending;
    return reply(cached);
  } catch {
    if (cached) return reply(cached, true);
    return NextResponse.json({ error: "Anthropic usage is temporarily unavailable." }, { status: 503 });
  }
}
