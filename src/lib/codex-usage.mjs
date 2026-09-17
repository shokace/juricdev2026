export const CODEX_USAGE_KEY = "codex:account-usage:v1";
export const CODEX_USAGE_STALE_MS = 60 * 60 * 1000;

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
    updated_at: updatedAt,
  };
  if (snapshot.total_tokens === null) throw new Error("Codex totals unavailable.");
  return snapshot;
}

/** @param {Record<string, unknown>} summary */
export function snapshotFromSummary(summary, now = Date.now()) {
  return normalizeCodexUsage({
    total_tokens: summary.lifetimeTokens,
    peak_daily_tokens: summary.peakDailyTokens,
    current_streak_days: summary.currentStreakDays,
    longest_session_seconds: summary.longestRunningTurnSec,
    updated_at: now,
  });
}
