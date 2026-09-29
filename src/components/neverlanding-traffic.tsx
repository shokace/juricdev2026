"use client";

import { useEffect, useRef, useState } from "react";
import type { NeverLandingStats } from "@/lib/neverlanding";

const number = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export default function NeverlandingTraffic() {
  const container = useRef<HTMLElement>(null);
  const [stats, setStats] = useState<NeverLandingStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let visible = false;
    let controller: AbortController | null = null;

    async function refresh() {
      if (!visible || document.hidden || controller) return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12_000);
      try {
        const response = await fetch("/api/neverlanding/stats", { signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data: NeverLandingStats = await response.json();
        if (!Array.isArray(data.points) || data.points.length < 2 || !Number.isFinite(data.requests)
          || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("Invalid traffic data");
        if (!disposed) { setStats(data); setFailed(false); }
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        clearTimeout(timeout);
        controller = null;
        if (!disposed) setCheckedAt(Date.now());
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) void refresh();
    }, { rootMargin: "200px" });
    if (container.current) observer.observe(container.current);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(() => { void refresh(); }, 60_000);
    return () => {
      disposed = true;
      controller?.abort();
      observer.disconnect();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const stale = failed || Boolean(stats && checkedAt - Date.parse(stats.updatedAt) > 180_000);
  const points = stats?.points ?? [];
  const peak = Math.max(1, ...points.map(point => point.requests));
  const line = points.map((point, index) => {
    const x = 1 + index / Math.max(1, points.length - 1) * 62;
    const y = 18 - point.requests / peak * 16;
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const summary = stats
    ? `${stats.estimated ? "Approximately " : ""}${stats.requests.toLocaleString("en-US")} HTTP requests in the last 30 days. Cloudflare${stats.estimated ? " estimates" : ""}; refreshes every minute. Last updated ${new Date(stats.updatedAt).toLocaleString()}.${stale ? " Refresh delayed." : ""}`
    : failed ? "Cloudflare traffic is temporarily unavailable. Retrying shortly." : "Loading Cloudflare traffic.";

  return (
    <figure className="traffic-chart" ref={container} title={summary} aria-label={summary}>
      {stats && <svg className="traffic-sparkline" viewBox="0 0 64 20" aria-hidden="true">
        <path d={line} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>}
      <figcaption className="traffic-caption">
        {stats
          ? <>{stats.estimated ? "≈" : ""}{number.format(stats.requests)} requests <span aria-hidden="true">·</span> 30 days{stale && <span className="traffic-delayed"> · delayed</span>}</>
          : failed ? "Traffic unavailable" : "Loading traffic…"}
      </figcaption>
    </figure>
  );
}
