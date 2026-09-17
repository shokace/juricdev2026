export const CODEX_USAGE_KEY = "codex:account-usage:v1";
export const CODEX_USAGE_STALE_MS = 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** @param {unknown} value */
function dailyUsage(value) {
  if (value == null) return null;
  if (!Array.isArray(value)) throw new Error("Invalid Codex daily usage.");
  const dates = new Set();
  return value.map((bucket) => {
    const date = bucket?.date;
    const tokens = metric(bucket?.tokens);
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
        tokens === null || dates.has(date)) {
      throw new Error("Invalid Codex daily usage bucket.");
    }
    dates.add(date);
    return { date, tokens };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/** @param {unknown} value */
function metric(value) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid Codex usage metric.");
  }
  return /** @type {number} */ (value);
}

/** Validate and allowlist the public snapshot; never pass through account data.
 * @param {unknown} value
 */
export function normalizeCodexUsage(value) {
  if (!value || typeof value !== "object") throw new Error("Missing Codex usage.");
  const raw = /** @type {Record<string, unknown>} */ (value);
  const updatedAt = metric(raw.updated_at);
  if (!updatedAt || updatedAt > Date.now() + 60_000) {
    throw new Error("Invalid Codex usage timestamp.");
  }
  const snapshot = {
    total_tokens: metric(raw.total_tokens),
    peak_daily_tokens: metric(raw.peak_daily_tokens),
    current_streak_days: metric(raw.current_streak_days),
    longest_session_seconds: metric(raw.longest_session_seconds),
    daily_usage: dailyUsage(raw.daily_usage),
    updated_at: updatedAt,
  };
  if (snapshot.total_tokens === null) throw new Error("Codex totals unavailable.");
  return snapshot;
}

/** @param {Record<string, unknown>} summary
 * @param {number} now
 * @param {Array<{ startDate: string, tokens: number }> | null} buckets
 */
export function snapshotFromSummary(summary, now = Date.now(), buckets = null) {
  return normalizeCodexUsage({
    total_tokens: summary.lifetimeTokens,
    peak_daily_tokens: summary.peakDailyTokens,
    current_streak_days: summary.currentStreakDays,
    longest_session_seconds: summary.longestRunningTurnSec,
    updated_at: now,
    daily_usage: buckets == null ? null : buckets.map(({ startDate, tokens }) => ({ date: startDate, tokens })),
  });
}

/** Calendar cells use UTC date-only buckets, independent of the visitor's timezone.
 * @param {Array<{ date: string, tokens: number }>} buckets
 */
export function buildCodexHeatmap(buckets, updatedAt, weeks = 16) {
  const today = new Date(updatedAt).toISOString().slice(0, 10);
  const end = Date.parse(today);
  const start = end - (new Date(end).getUTCDay() + (weeks - 1) * 7) * DAY_MS;
  const counts = new Map(buckets.map((bucket) => [bucket.date, bucket.tokens]));
  const cells = Array.from({ length: weeks * 7 }, (_, index) => {
    const time = start + index * DAY_MS;
    const date = new Date(time).toISOString().slice(0, 10);
    return { date, tokens: counts.get(date) ?? 0, future: time > end };
  });
  const peak = Math.max(0, ...cells.filter((cell) => !cell.future).map((cell) => cell.tokens));
  return cells.map((cell) => ({
    ...cell,
    level: cell.tokens === 0 ? 0 : cell.tokens <= peak * 0.1 ? 1 : cell.tokens <= peak * 0.3 ? 2 : cell.tokens <= peak * 0.6 ? 3 : 4,
  }));
}
