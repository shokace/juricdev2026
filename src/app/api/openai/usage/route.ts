import { NextResponse } from "next/server";

type UsageResult = {
  input_tokens?: number;
  output_tokens?: number;
  input_cached_tokens?: number;
  input_audio_tokens?: number;
  output_audio_tokens?: number;
  num_model_requests?: number;
};

type UsageBucket = {
  start_time: number;
  end_time: number;
  results: UsageResult[];
};

type UsageResponse = {
  data: UsageBucket[];
  has_more: boolean;
  next_page: string | null;
};

type UsageTotals = {
  start_time: number;
  end_time: number;
  requests: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  updated_at: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: UsageTotals | null = null;
let cachedAt = 0;

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

export async function GET() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  const adminKey = process.env.OPENAI_ADMIN_KEY;
  const startDate = process.env.OPENAI_USAGE_START_DATE;

  if (!adminKey || !startDate) {
    return NextResponse.json(
      { error: "Missing OpenAI usage configuration." },
      { status: 500 }
    );
  }

  const startTime = toUnixSeconds(new Date(startDate));
  const endTime = toUnixSeconds(new Date());

  let page: string | null = null;
  let requests = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  do {
    const params = new URLSearchParams({
      start_time: startTime.toString(),
      end_time: endTime.toString(),
      bucket_width: "1d",
      limit: "31",
    });
    if (page) {
      params.set("page", page);
    }

    const response = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch OpenAI usage." },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as UsageResponse;
    payload.data.forEach((bucket) => {
      bucket.results.forEach((result) => {
        requests += result.num_model_requests ?? 0;
        inputTokens += result.input_tokens ?? 0;
        outputTokens += result.output_tokens ?? 0;
        cachedTokens += result.input_cached_tokens ?? 0;
      });
    });

    page = payload.has_more ? payload.next_page : null;
  } while (page);

  const totals: UsageTotals = {
    start_time: startTime,
    end_time: endTime,
    requests,
    tokens: inputTokens + outputTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: cachedTokens,
    updated_at: Math.floor(now / 1000),
  };

  cached = totals;
  cachedAt = now;

  return NextResponse.json(totals);
}
