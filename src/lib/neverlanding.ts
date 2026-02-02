type CloudflareResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequestsAdaptiveGroups?: Array<{
          count?: number;
          sum?: {
            visits?: number;
            edgeResponseBytes?: number;
          };
        }>;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

export type NeverLandingStats = {
  uniqueVisitors: number;
  requests: number;
  edgeResponseBytes: number;
  windowHours: number;
};

class CloudflareError extends Error {
  details: unknown;

  constructor(message: string, details: unknown) {
    super(message);
    this.details = details;
  }
}

export async function fetchNeverLandingStats(): Promise<NeverLandingStats> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneTag = process.env.CLOUDFLARE_ZONE_ID;

  if (!token || !zoneTag) {
    throw new Error("Missing Cloudflare credentials.");
  }

  const end = new Date();
  const days = 7;
  const dayMs = 24 * 60 * 60 * 1000;

  const query = `
    query ($zoneTag: String!, $start: Time!, $end: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 1
            filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }
          ) {
            count
            sum {
              visits
              edgeResponseBytes
            }
          }
        }
      }
    }
  `;

  const fetchWindow = async (start: Date, end: Date) => {
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          zoneTag,
          start: start.toISOString(),
          end: end.toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Cloudflare request failed.");
    }

    const payload = (await response.json()) as CloudflareResponse;

    if (payload.errors?.length) {
      throw new CloudflareError("Cloudflare GraphQL error.", payload.errors);
    }

    const group = payload?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups?.[0];
    return {
      visits: group?.sum?.visits ?? 0,
      requests: group?.count ?? 0,
      edgeResponseBytes: group?.sum?.edgeResponseBytes ?? 0,
    };
  };

  const windows = Array.from({ length: days }, (_, index) => {
    const windowEnd = new Date(end.getTime() - index * dayMs);
    const windowStart = new Date(windowEnd.getTime() - dayMs);
    return { windowStart, windowEnd };
  });

  const results = await Promise.all(
    windows.map(({ windowStart, windowEnd }) => fetchWindow(windowStart, windowEnd))
  );

  const visits = results.reduce((sum, current) => sum + current.visits, 0);
  const requests = results.reduce((sum, current) => sum + current.requests, 0);
  const edgeResponseBytes = results.reduce((sum, current) => sum + current.edgeResponseBytes, 0);

  return {
    windowHours: days * 24,
    uniqueVisitors: visits,
    requests,
    edgeResponseBytes,
  };
}

export function isCloudflareError(error: unknown): error is CloudflareError {
  return error instanceof CloudflareError;
}
