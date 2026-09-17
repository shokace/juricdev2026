"use client";

import { parseIssSnapshot } from "@/lib/iss-data.mjs";

export type IssSnapshot = {
  ok: boolean;
  latitude: string;
  longitude: string;
  timestamp: number | null;
  trail: unknown[];
};
type Listener = (snapshot: IssSnapshot) => void;
const listeners = new Set<Listener>();
let positionTimer: ReturnType<typeof setInterval> | null = null;
let lastTrailFetchAt = 0;
let inFlight = false;
let current: IssSnapshot = { ok: false, latitude: "--", longitude: "--", timestamp: null, trail: [] };

async function poll() {
  if (inFlight || document.hidden || !listeners.size) return;
  inFlight = true;
  const wantTrail = Date.now() - lastTrailFetchAt >= 5 * 60_000;
  try {
    const response = await fetch(wantTrail ? "/api/iss" : "/api/iss?trail=0", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("ISS request failed.");
    const payload = await response.json();
    current = parseIssSnapshot(payload, current.trail);
    if (wantTrail && Array.isArray(payload.trail)) lastTrailFetchAt = Date.now();
  } catch {
    current = { ...current, ok: false };
  } finally {
    inFlight = false;
  }
  for (const listener of listeners) listener(current);
}

function onVisibilityChange() { if (!document.hidden) void poll(); }

export function subscribeIss(listener: Listener): () => void {
  listeners.add(listener);
  // Don't briefly label an old retained snapshot as live when revisiting the tracker.
  listener({ ...current, ok: current.ok && !!current.timestamp && Date.now() - current.timestamp * 1000 < 45_000 });
  if (!positionTimer) {
    void poll();
    positionTimer = setInterval(poll, 10_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && positionTimer) {
      clearInterval(positionTimer);
      positionTimer = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}
