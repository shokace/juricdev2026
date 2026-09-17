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
