export type NeverLandingStats = {
  requests: number;
  estimated: boolean;
  windowStart: string;
  windowEnd: string;
  updatedAt: string;
  intervalMinutes: 1440;
  points: Array<{ timestamp: string; requests: number }>;
};

type CloudflareResponse = {
  data?: { viewer?: { zones?: Array<{
    httpRequestsAdaptiveGroups?: Array<{
      count?: number;
      avg?: { sampleInterval?: number };
      dimensions?: { date?: string };
    }>;
  }> } };
  errors?: unknown[];
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const INTERVAL = DAY;

const query = `
  query ($zoneTag: String!, $start: Time!, $end: Time!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequestsAdaptiveGroups(
          limit: 32
          orderBy: [date_ASC]
          filter: {
            datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball"
            clientRequestHTTPHost_in: ["neverlanding.page", "www.neverlanding.page"]
          }
        ) {
          count
          avg { sampleInterval }
          dimensions { date }
        }
      }
    }
  }
`;

// Empty successful groups mean no requests. Missing/invalid data is an error,
// never a zero-traffic graph. Only aggregate timestamps and counts leave the server.
export function normalizeNeverLandingStats(
  payload: CloudflareResponse, start: number, end: number, updatedAt: number,
): NeverLandingStats {
  const zones = payload?.data?.viewer?.zones;
  const groups = zones?.[0]?.httpRequestsAdaptiveGroups;
  if (payload?.errors?.length || zones?.length !== 1 || !Array.isArray(groups)) {
    throw new Error("Cloudflare analytics unavailable.");
  }

  const first = Math.floor(start / INTERVAL) * INTERVAL;
  const counts = new Map<number, number>();
  let estimated = false;
  for (const group of groups) {
    const timestamp = Date.parse(`${group.dimensions?.date}T00:00:00.000Z`);
    const count = group.count;
    const sampleInterval = group.avg?.sampleInterval;
    if (!Number.isFinite(timestamp) || timestamp % INTERVAL !== 0 || timestamp < first || timestamp >= end
      || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0
      || typeof sampleInterval !== "number" || !Number.isFinite(sampleInterval) || sampleInterval < 1
      || counts.has(timestamp)) {
      throw new Error("Invalid Cloudflare analytics.");
    }
    counts.set(timestamp, count);
    estimated ||= sampleInterval > 1;
  }

  const points = Array.from({ length: Math.ceil((end - first) / INTERVAL) }, (_, index) => {
    const timestamp = first + index * INTERVAL;
    return { timestamp: new Date(timestamp).toISOString(), requests: counts.get(timestamp) ?? 0 };
  });
  return {
    requests: points.reduce((sum, point) => sum + point.requests, 0),
    estimated,
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
    intervalMinutes: 1440,
    points,
  };
}

export function createNeverLandingStatsReader({
  fetcher = fetch,
  now = Date.now,
  credentials = () => ({ token: process.env.CLOUDFLARE_API_TOKEN, zoneTag: process.env.CLOUDFLARE_ZONE_ID }),
}: {
  fetcher?: typeof fetch;
  now?: () => number;
  credentials?: () => { token: string | undefined; zoneTag: string | undefined };
} = {}) {
  let cached: NeverLandingStats | null = null;
  let pending: Promise<NeverLandingStats> | null = null;

  async function refresh() {
    const { token, zoneTag } = credentials();
    if (!token || !zoneTag) throw new Error("Cloudflare analytics unavailable.");
    const end = Math.floor(now() / MINUTE) * MINUTE;
    const start = end - 30 * DAY;
    const response = await fetcher("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: {
        zoneTag, start: new Date(start).toISOString(), end: new Date(end).toISOString(),
      } }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("Cloudflare analytics unavailable.");
    cached = normalizeNeverLandingStats(await response.json(), start, end, now());
    return cached;
  }

  return async function readStats() {
    if (cached && now() - Date.parse(cached.updatedAt) < MINUTE) return cached;
    if (!pending) pending = refresh().finally(() => { pending = null; });
    return pending;
  };
}

// Coalesce concurrent visitors and cap upstream refreshes to once per minute
// within each edge instance. Public responses can also be cached for one minute.
export const fetchNeverLandingStats = createNeverLandingStatsReader();
