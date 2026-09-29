"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { NeverLandingStats } from "@/lib/neverlanding";

const number = new Intl.NumberFormat("en-US");
const time = (timestamp: string | number) => new Date(timestamp).toLocaleTimeString([], {
  hour: "2-digit", minute: "2-digit", hour12: false,
});
const day = (timestamp: string) => new Date(timestamp).toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
});

export default function NeverlandingTraffic() {
  const container = useRef<HTMLElement>(null);
  const gradientId = useId();
  const [stats, setStats] = useState<NeverLandingStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const [active, setActive] = useState<number | null>(null);

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
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.ceil(peak / magnitude) * magnitude;
  const x = (index: number) => 4 + index / Math.max(1, points.length - 1) * 392;
  const y = (count: number) => 88 - count / ceiling * 72;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.requests).toFixed(2)}`).join(" ");
  const selected = active === null ? null : Math.min(active, points.length - 1);
  const point = selected === null ? null : points[selected];
  const partial = point && stats && (Date.parse(point.timestamp) < Date.parse(stats.windowStart)
    || Date.parse(point.timestamp) + 86_400_000 > Date.parse(stats.windowEnd));
  const readout = point ? `${day(point.timestamp)}${partial ? " (partial)" : ""} · ${stats?.estimated ? "≈" : ""}${number.format(point.requests)} requests` : "Daily requests · UTC";

  function selectPoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round((fraction * 400 - 4) / 392 * (points.length - 1)))));
  }

  return (
    <figure className="traffic-chart" ref={container} aria-label="Neverlanding.page traffic from Cloudflare">
      <figcaption className="traffic-heading">
        <span className="traffic-label">Traffic <span> / last 30 days</span></span>
        <span className={`traffic-status${!stats || stale ? " traffic-status-muted" : ""}`}>
          <span aria-hidden="true" />{stats ? stale ? "Delayed" : "Live" : "Cloudflare"}
        </span>
      </figcaption>
      {stats ? <>
        <p className="traffic-total"><strong>{stats.estimated ? "≈" : ""}{number.format(stats.requests)}</strong> requests</p>
        <div
          className="traffic-plot"
          role="slider"
          tabIndex={0}
          aria-label="Requests by time. Use arrow keys to explore daily totals."
          aria-valuemin={0}
          aria-valuemax={points.length - 1}
          aria-valuenow={selected ?? points.length - 1}
          aria-valuetext={point ? readout : `${number.format(stats.requests)} requests over the last 30 days. ${stats.estimated ? "Estimated by Cloudflare." : ""}`}
          onPointerMove={selectPoint}
          onPointerDown={event => {
            event.currentTarget.focus();
            selectPoint(event);
          }}
          onPointerLeave={event => { if (event.pointerType !== "touch") setActive(null); }}
          onFocus={() => setActive(points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={event => {
            const current = selected ?? points.length - 1;
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") setActive(Math.max(0, current - 1));
            else if (event.key === "ArrowRight" || event.key === "ArrowUp") setActive(Math.min(points.length - 1, current + 1));
            else if (event.key === "Home") setActive(0);
            else if (event.key === "End") setActive(points.length - 1);
            else if (event.key === "Escape") setActive(null);
            else return;
            event.preventDefault();
          }}
        >
          <svg viewBox="0 0 400 94" aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#294f9f" stopOpacity=".18" /><stop offset="100%" stopColor="#294f9f" stopOpacity=".015" /></linearGradient></defs>
            {[16, 52, 88].map(height => <line key={height} x1="4" x2="396" y1={height} y2={height} className="traffic-grid" />)}
            <text x="396" y="10" textAnchor="end" className="traffic-scale">{number.format(ceiling)}</text>
            <path d={`${line} L396,88 L4,88 Z`} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke="#294f9f" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {point && selected !== null && <g>
              <line x1={x(selected)} x2={x(selected)} y1="14" y2="88" className="traffic-cursor" />
              <circle cx={x(selected)} cy={y(point.requests)} r="3.5" fill="#294f9f" stroke="#fcfcfd" strokeWidth="2" />
            </g>}
          </svg>
        </div>
        <div className="traffic-axis" aria-hidden="true"><span>30d ago</span><span>15d ago</span><span>Latest</span></div>
        <p className="traffic-readout">{readout}</p>
        <div className="traffic-source">
          <span title="Cloudflare analytics may be delayed. The first and last days can be partial.">Cloudflare{stats.estimated ? " estimates" : ""} · refreshes every minute</span>
          <time dateTime={stats.updatedAt} title={`Last successful update: ${new Date(stats.updatedAt).toLocaleString()}`}>{stale ? "Last update " : "Updated "}{time(stats.updatedAt)}</time>
        </div>
      </> : <div className="traffic-placeholder" role="status">
        {failed ? "Traffic data is temporarily unavailable. Retrying shortly." : "Loading Cloudflare traffic…"}
        <noscript>Enable JavaScript to view live traffic.</noscript>
      </div>}
    </figure>
  );
}
