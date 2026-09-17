"use client";

import { useEffect, useState } from "react";
import { subscribeIss, type IssSnapshot } from "@/lib/iss-feed";

function coordinate(value: string, latitude: boolean) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const direction = latitude ? number < 0 ? "S" : "N" : number < 0 ? "W" : "E";
  return `${Math.abs(number).toFixed(2)}° ${direction}`;
}

export default function IssTelemetry() {
  const [snapshot, setSnapshot] = useState<IssSnapshot>({ ok: false, latitude: "--", longitude: "--", timestamp: null, trail: [] });
  const [now, setNow] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeIss(setSnapshot);
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);
  const stale = snapshot.timestamp !== null && now > 0 && now - snapshot.timestamp * 1000 > 45_000;
  const live = snapshot.ok && !stale;
  const status = live ? "Live" : snapshot.timestamp ? "Reconnecting" : "Connecting";
  return (
    <div className="iss-telemetry">
      <div><span className="telemetry-label">Latitude</span><span className="telemetry-value">{coordinate(snapshot.latitude, true)}</span></div>
      <div><span className="telemetry-label">Longitude</span><span className="telemetry-value">{coordinate(snapshot.longitude, false)}</span></div>
      <div role="status"><span className="telemetry-label">Signal Integrity</span><span className={`telemetry-value signal-state ${live ? "is-live" : "is-waiting"}`}><i aria-hidden="true" />{status}</span></div>
      {snapshot.timestamp && <p className="telemetry-time">{live ? "Position updated" : "Last known position"} <time dateTime={new Date(snapshot.timestamp * 1000).toISOString()}>{new Date(snapshot.timestamp * 1000).toISOString().slice(11, 19)} UTC</time></p>}
    </div>
  );
}
