"use client";

import { useEffect, useState } from "react";
import { CODEX_USAGE_STALE_MS, normalizeCodexUsage } from "@/lib/codex-usage.mjs";

type Usage = ReturnType<typeof normalizeCodexUsage>;
const number = new Intl.NumberFormat("en-US");
const format = (value: number | null | undefined) => value == null ? "--" : number.format(value);

export default function CodexUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [status, setStatus] = useState("LOADING");

  useEffect(() => {
    const controller = new AbortController();
    let lastUsage: Usage | null = null;
    const refresh = async () => {
      try {
        const response = await fetch("/api/codex/usage", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("Usage unavailable");
        const snapshot = normalizeCodexUsage(await response.json());
        if (controller.signal.aborted) return;
        lastUsage = snapshot;
        setUsage(snapshot);
        setStatus(Date.now() - snapshot.updated_at > CODEX_USAGE_STALE_MS ? "STALE" : "SYNCED");
      } catch {
        if (!controller.signal.aborted) setStatus(lastUsage ? "STALE" : "UNAVAILABLE");
      }
    };
    void refresh();
    const interval = setInterval(refresh, 60_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  const seconds = usage?.longest_session_seconds;
  const duration = seconds == null ? "--" : seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  const rows = [
    ["Total Tokens", format(usage?.total_tokens)],
    ["Peak Day", format(usage?.peak_daily_tokens)],
    ["Current Streak", usage?.current_streak_days == null ? "--" : `${format(usage.current_streak_days)} days`],
    ["Longest Turn", duration],
  ];

  return (
    <div className="space-y-3 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <span className="text-[color:var(--text0)] tabular-nums">{value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between" role="status">
        <span>Status</span>
        <span className={status === "SYNCED" ? "text-[color:var(--accent-green)]" : status === "UNAVAILABLE" ? "text-[color:var(--accent-red)]" : "text-muted"}>{status}</span>
      </div>
      {usage && (
        <p className="text-[0.6rem] tracking-[0.1em]" title="Account totals refresh every 15 minutes while my Mac is awake.">
          Updated <time dateTime={new Date(usage.updated_at).toISOString()}>{new Date(usage.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
        </p>
      )}
    </div>
  );
}
