"use client";

export type IssSnapshot = {
  ok: boolean;
  latitude: string;
  longitude: string;
  timestamp: number | null;
  trail: unknown[];
};

type Listener = (snapshot: IssSnapshot) => void;

const POSITION_INTERVAL_MS = 10 * 1000;
const TRAIL_REFRESH_MS = 5 * 60 * 1000;

const listeners = new Set<Listener>();
let positionTimer: ReturnType<typeof setInterval> | null = null;
let lastTrailFetchAt = 0;
let inFlight = false;
let current: IssSnapshot = {
  ok: false,
  latitude: "--",
  longitude: "--",
  timestamp: null,
  trail: [],
};

async function poll() {
  if (inFlight) {
    return;
  }
  inFlight = true;

  const wantTrail = Date.now() - lastTrailFetchAt >= TRAIL_REFRESH_MS;
  try {
    const response = await fetch(wantTrail ? "/api/iss" : "/api/iss?trail=0", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("ISS request failed.");
    }
    const payload = await response.json();
    const latitude = payload?.iss_position?.latitude;
    const longitude = payload?.iss_position?.longitude;
    if (latitude == null || longitude == null) {
      throw new Error("ISS payload malformed.");
    }
    if (wantTrail) {
      lastTrailFetchAt = Date.now();
    }
    current = {
      ok: payload?.message === "success",
      latitude: String(latitude),
      longitude: String(longitude),
      timestamp: Number.isFinite(Number(payload?.timestamp))
        ? Number(payload.timestamp)
        : null,
      trail: Array.isArray(payload?.trail) ? payload.trail : current.trail,
    };
  } catch {
    current = { ...current, ok: false };
  } finally {
    inFlight = false;
  }

  for (const listener of listeners) {
    listener(current);
  }
}

export function subscribeIss(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);

  if (!positionTimer) {
    poll();
    positionTimer = setInterval(poll, POSITION_INTERVAL_MS);
  }

  return () => {
    listeners.delete(listener);
    if (!listeners.size && positionTimer) {
      clearInterval(positionTimer);
      positionTimer = null;
    }
  };
}
