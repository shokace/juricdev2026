export const ANTHROPIC_USAGE_TTL = 60 * 60 * 1000;
const RETRY_DELAY = 60_000;

// Keep the last good report visible while the slow, paginated refresh runs.
// defer must attach work to the request lifetime (Next after / waitUntil).
export function createAnthropicUsageCache({ readSaved, refresh, saveSummary, now = Date.now }) {
  let cached = null;
  let reading = null;
  let pending = null;
  let retryAfter = 0;
  const fresh = () => cached && now() - cached.updated_at < ANTHROPIC_USAGE_TTL;

  async function restore() {
    if (!reading) reading = Promise.resolve().then(readSaved).then(saved => {
      if (saved && (!cached || saved.updated_at > cached.updated_at)) cached = saved;
    }).catch(() => {}).finally(() => { reading = null; });
    await reading;
  }

  function revalidate(defer, checkSaved) {
    if (pending) return pending;
    if (now() < retryAfter) return Promise.resolve(null);
    let changed = false;
    const work = (async () => {
      // Another edge instance may already have refreshed the shared snapshot.
      if (checkSaved) await restore();
      if (fresh()) return cached;
      const summary = await refresh();
      cached = summary;
      changed = true;
      retryAfter = 0;
      return summary;
    })().catch(() => {
      retryAfter = now() + RETRY_DELAY;
      return null;
    });
    pending = work;
    // Persistence is also background work, including on the first cache miss.
    // Keep the refresh deduplicated until the shared snapshot is saved.
    defer(work.then(summary => changed ? saveSummary(summary) : undefined)
      .catch(() => {}).finally(() => { pending = null; }));
    return work;
  }

  return async function getUsage(defer) {
    const hadCached = Boolean(cached);
    if (!cached) await restore();
    if (cached) {
      const result = { summary: cached, stale: !fresh() };
      if (result.stale) revalidate(defer, hadCached);
      return result;
    }
    const summary = await revalidate(defer, false);
    return summary ? { summary, stale: false } : null;
  };
}
