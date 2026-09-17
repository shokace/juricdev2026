"use client";

import { useEffect, useState } from "react";
import CodexUsageMap from "@/components/codex-usage-map";

type Usage = {
  input_tokens: number; output_tokens: number; total_tokens: number;
  total_cost_usd: number | null; updated_at: number; since: string; stale: boolean;
  daily_usage: { date: string; tokens: number }[];
};
const number = new Intl.NumberFormat("en-US");
const format = (value: number | null | undefined) => value == null ? "--" : number.format(value);

export default function AnthropicUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [status, setStatus] = useState("LOADING");
  useEffect(() => {
    const controller = new AbortController();
    let last: Usage | null = null;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/anthropic/usage", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
        if (!response.ok) throw new Error("Usage unavailable");
        const snapshot: Usage = await response.json();
        if (![snapshot.total_tokens, snapshot.input_tokens, snapshot.output_tokens, snapshot.updated_at].every(n => Number.isFinite(n) && n >= 0) || !Array.isArray(snapshot.daily_usage)) throw new Error("Invalid usage");
        if (controller.signal.aborted) return;
        last = snapshot;
        setUsage(snapshot);
        setStatus(snapshot.stale || Date.now() - snapshot.updated_at > 2 * 60 * 60 * 1000 ? "STALE" : "SYNCED");
      } catch {
        if (!controller.signal.aborted) setStatus(last ? "STALE" : "UNAVAILABLE");
      }
    };
    void refresh();
    const interval = setInterval(refresh, 5 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const rows = [
    ["Total Tokens", format(usage?.total_tokens)],
    ["Input Tokens", format(usage?.input_tokens)],
    ["Output Tokens", format(usage?.output_tokens)],
    ["API Cost", usage?.total_cost_usd == null ? "--" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usage.total_cost_usd)],
  ];
  return (
    <div className="flex flex-1 flex-col gap-3 text-[0.78rem] tracking-normal text-muted">
      {rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-2"><span>{label}</span><span className="text-[color:var(--text0)] tabular-nums tracking-normal">{value}</span></div>)}
      <div className="flex items-center justify-between" role="status"><span>Status</span><span className="text-[color:var(--accent-green)]">{status}</span></div>
      <div className="mt-auto pt-2"><CodexUsageMap dailyUsage={usage?.daily_usage ?? null} updatedAt={usage?.updated_at ?? Date.now()} provider="Claude" /></div>
      <p className="text-[0.6rem] tracking-normal">{usage ? <>API usage since <time dateTime={usage.since}>{usage.since}</time></> : "Anthropic API usage"}</p>
    </div>
  );
}
