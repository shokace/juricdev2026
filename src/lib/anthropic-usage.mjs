const count = value => {
  if (value == null) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid token count");
  return value;
};

// Return only public aggregates; never forward organization, workspace or key IDs.
export function summarizeAnthropicUsage(buckets, updatedAt, since) {
  let input = 0, output = 0, read = 0, write = 0;
  const days = new Map();
  for (const bucket of buckets) {
    if (!Number.isFinite(Date.parse(bucket.starting_at)) || !Array.isArray(bucket.results)) throw new Error("Invalid usage bucket");
    let tokens = 0;
    for (const result of bucket.results) {
      const i = count(result.uncached_input_tokens), o = count(result.output_tokens);
      const r = count(result.cache_read_input_tokens);
      const w = count(result.cache_creation?.ephemeral_5m_input_tokens) + count(result.cache_creation?.ephemeral_1h_input_tokens);
      input += i; output += o; read += r; write += w; tokens += i + o + r + w;
    }
    const date = new Date(bucket.starting_at).toISOString().slice(0, 10);
    days.set(date, (days.get(date) ?? 0) + tokens);
  }
  return { input_tokens: input, output_tokens: output, cached_read_tokens: read, cached_creation_tokens: write,
    total_tokens: input + output + read + write, total_cost_usd: null, updated_at: updatedAt, since,
    daily_usage: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, tokens]) => ({ date, tokens })) };
}

export function summarizeAnthropicCost(buckets) {
  let cents = 0;
  for (const bucket of buckets) {
    if (!Array.isArray(bucket.results)) throw new Error("Invalid cost bucket");
    for (const result of bucket.results) {
      if (result.currency !== "USD" || typeof result.amount !== "string" || !/^\d+(\.\d+)?$/.test(result.amount)) throw new Error("Invalid cost");
      const amount = Number(result.amount);
      if (!Number.isFinite(amount)) throw new Error("Invalid cost");
      cents += amount;
    }
  }
  return cents / 100;
}

export const ANTHROPIC_USAGE_KEY = "anthropic:api-usage:v1";
export function normalizeAnthropicSnapshot(value) {
  const date = input => {
    if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(Date.parse(input)) || new Date(input).toISOString().slice(0, 10) !== input) throw new Error("Invalid usage date");
    return input;
  };
  if (!value || !Array.isArray(value.daily_usage) || !value.updated_at || value.updated_at > Date.now() + 60_000) throw new Error("Invalid usage snapshot");
  const cost = value.total_cost_usd;
  if (cost !== null && (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0)) throw new Error("Invalid cost");
  return {
    input_tokens: count(value.input_tokens), output_tokens: count(value.output_tokens),
    cached_read_tokens: count(value.cached_read_tokens), cached_creation_tokens: count(value.cached_creation_tokens),
    total_tokens: count(value.total_tokens), total_cost_usd: cost,
    updated_at: count(value.updated_at), since: date(value.since),
    daily_usage: value.daily_usage.map(day => ({ date: date(day.date), tokens: count(day.tokens) })),
  };
}
