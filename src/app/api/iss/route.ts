import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 0;
export const dynamic = "force-dynamic";

const ISS_TRAIL_WINDOW_MS = 30 * 60 * 1000;
const ISS_TRAIL_KEY = "iss-trail-points-v1";
const ISS_KV_WRITE_INTERVAL_MS = 2 * 60 * 1000;

type IssResponse = {
  message: string;
  timestamp: number;
  iss_position: {
    latitude: string;
    longitude: string;
  };
};

type IssTrailPoint = {
  lat: number;
  lon: number;
  ts: number;
};

type IssRouteResponse = IssResponse & {
  trail: IssTrailPoint[];
};

declare global {
  var __issKvWriteBlockedUntil: number | undefined;
}

function getNextUtcMidnightMs(now: number): number {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
}

function pruneTrail(points: IssTrailPoint[], now: number): IssTrailPoint[] {
  return points.filter((point) => now - point.ts <= ISS_TRAIL_WINDOW_MS);
}

function normalizeTrail(input: unknown): IssTrailPoint[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(
      (point): point is IssTrailPoint =>
        typeof point === "object" &&
        point !== null &&
        typeof (point as IssTrailPoint).lat === "number" &&
        typeof (point as IssTrailPoint).lon === "number" &&
        typeof (point as IssTrailPoint).ts === "number"
    )
    .sort((a, b) => a.ts - b.ts);
}

async function fetchIssNow(): Promise<IssResponse> {
  const response = await fetch("http://api.open-notify.org/iss-now.json", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch ISS position.");
  }

  const payload = (await response.json()) as IssResponse;
  if (payload.message !== "success") {
    throw new Error("ISS API returned an error.");
  }

  return payload;
}

type KvConfig = {
  token: string;
  accountId: string;
  namespaceId: string;
};

function getKvConfig(): KvConfig | null {
  const token =
    process.env.KVTok ??
    process.env.CLOUDFLARE_KV_API_TOKEN ??
    process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID_ISS;

  if (!token || !accountId || !namespaceId) {
    return null;
  }

  return { token, accountId, namespaceId };
}

function kvValueUrl(config: KvConfig): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${ISS_TRAIL_KEY}`;
}

async function loadTrail(config: KvConfig): Promise<IssTrailPoint[]> {
  const response = await fetch(kvValueUrl(config), {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error("Failed to read ISS trail from Cloudflare KV.");
  }

  const raw = await response.text();
  if (!raw) {
    return [];
  }

  try {
    return normalizeTrail(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveTrail(config: KvConfig, trail: IssTrailPoint[]): Promise<boolean> {
  const response = await fetch(kvValueUrl(config), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(trail),
  });

  if (response.ok) {
    return true;
  }

  const body = (await response.text()).toLowerCase();
  const quotaExceeded =
    body.includes("daily limit") || body.includes("1000 workers kv put operations");

  if (quotaExceeded) {
    globalThis.__issKvWriteBlockedUntil = getNextUtcMidnightMs(Date.now());
    return false;
  }

  throw new Error("Failed to write ISS trail to Cloudflare KV.");
}

async function getSnapshot(): Promise<IssRouteResponse> {
  const payload = await fetchIssNow();
  const now = Date.now();
  const kvConfig = getKvConfig();

  let trail: IssTrailPoint[] = [];
  if (kvConfig) {
    try {
      trail = await loadTrail(kvConfig);
    } catch {
      trail = [];
    }
  }

  const lat = Number(payload.iss_position.latitude);
  const lon = Number(payload.iss_position.longitude);
  let shouldPersistPoint = false;

  if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
    const last = trail[trail.length - 1];
    const isDuplicatePosition = Boolean(last && last.lat === lat && last.lon === lon);
    const enoughTimeElapsed = !last || now - last.ts >= ISS_KV_WRITE_INTERVAL_MS;
    shouldPersistPoint = Boolean(!isDuplicatePosition && enoughTimeElapsed);
    if (shouldPersistPoint) {
      trail = [...trail, { lat, lon, ts: now }];
    }
  }

  trail = pruneTrail(trail, now);

  const isWriteBlocked =
    typeof globalThis.__issKvWriteBlockedUntil === "number" &&
    now < globalThis.__issKvWriteBlockedUntil;

  if (kvConfig && shouldPersistPoint && !isWriteBlocked) {
    try {
      await saveTrail(kvConfig, trail);
    } catch {
      // Return live data even if persistence write fails.
    }
  }

  return { ...payload, trail };
}

export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch ISS position." },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}
