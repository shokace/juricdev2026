import { NextResponse } from "next/server";

type UsageResult = {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  output_tokens: number;
};

type UsageBucket = {
  starting_at: string;
  ending_at: string;
  results: UsageResult[];
};

type UsageResponse = {
  data: UsageBucket[];
  has_more: boolean;
  next_page: string | null;
};

type UsageTotals = {
  input_tokens: number;
  output_tokens: number;
  cached_read_tokens: number;
  cached_creation_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  updated_at: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cached: UsageTotals | null = null;
let cachedAt = 0;

export async function GET() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  const startDate = process.env.ANTHROPIC_USAGE_START_DATE;

  if (!adminKey || !startDate) {
    return NextResponse.json(
      { error: "Missing Anthropic usage configuration." },
      { status: 500 }
    );
  }

  let page: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedReadTokens = 0;
  let cachedCreationTokens = 0;

  do {
    const params = new URLSearchParams({
      starting_at: new Date(startDate).toISOString(),
      ending_at: new Date().toISOString(),
      bucket_width: "1h",
      limit: "168",
    });
    if (page) {
      params.set("page", page);
    }

    const response = await fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?${params.toString()}`,
      {
        headers: {
          "x-api-key": adminKey,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // If rate limited and we have cached data, return it even if stale
      if (errorData.error?.type === "rate_limit_error" && cached) {
        return NextResponse.json(cached);
      }

      return NextResponse.json(
        { error: `Failed to fetch Anthropic usage: ${errorData.error?.message || "Unknown error"}` },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as UsageResponse;
    for (const bucket of payload.data) {
      for (const result of bucket.results) {
        inputTokens += result.uncached_input_tokens ?? 0;
        outputTokens += result.output_tokens ?? 0;
        cachedReadTokens += result.cache_read_input_tokens ?? 0;
        cachedCreationTokens +=
          (result.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
          (result.cache_creation?.ephemeral_1h_input_tokens ?? 0);
      }
    }

    page = payload.has_more ? payload.next_page : null;
  } while (page);

  // Calculate estimated cost based on token usage
  // Using Claude Sonnet pricing as baseline: $3/MTok input, $15/MTok output
  // Cache writes: $3.75/MTok, Cache reads: $0.30/MTok
  const inputCost = (inputTokens / 1_000_000) * 3.0;
  const outputCost = (outputTokens / 1_000_000) * 15.0;
  const cacheReadCost = (cachedReadTokens / 1_000_000) * 0.3;
  const cacheWriteCost = (cachedCreationTokens / 1_000_000) * 3.75;
  const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

  const totals: UsageTotals = {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_read_tokens: cachedReadTokens,
    cached_creation_tokens: cachedCreationTokens,
    total_tokens: inputTokens + outputTokens + cachedReadTokens + cachedCreationTokens,
    total_cost_usd: totalCost,
    updated_at: Math.floor(now / 1000),
  };

  cached = totals;
  cachedAt = now;

  return NextResponse.json(totals);
}
