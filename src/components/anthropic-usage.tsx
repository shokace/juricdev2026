"use client";

import { useEffect, useState } from "react";
import CodexUsageMap from "@/components/codex-usage-map";
import { normalizeAnthropicSnapshot } from "@/lib/anthropic-usage.mjs";
import { ANTHROPIC_USAGE_TTL } from "@/lib/anthropic-usage-cache.mjs";

type Usage = {
  input_tokens: number; output_tokens: number; total_tokens: number;
  total_cost_usd: number | null; updated_at: number; since: string; stale: boolean;
  daily_usage: { date: string; tokens: number }[];
};
const number = new Intl.NumberFormat("en-US");
const format = (value: number | null | undefined) => value == null ? "--" : number.format(value);
const STORAGE_KEY = "juric:anthropic-usage:v1";
const isStale = (snapshot: Usage) => snapshot.stale || Date.now() - snapshot.updated_at >= ANTHROPIC_USAGE_TTL;
const normalize = (value: Usage): Usage => ({ ...normalizeAnthropicSnapshot(value), stale: value.stale === true });

export default function AnthropicUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [status, setStatus] = useState("LOADING");
  useEffect(() => {
    const controller = new AbortController();
    let last: Usage | null = null;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const display = (snapshot: Usage) => {
      last = snapshot;
      setUsage(snapshot);
      setStatus(isStale(snapshot) ? "STALE" : "SYNCED");
    };
    const refresh = async () => {
      if (document.hidden || inFlight || controller.signal.aborted) return;
      clearTimeout(timer);
      inFlight = true;
      let delay = 15_000;
      try {
        const response = await fetch("/api/anthropic/usage", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
        if (!response.ok) throw new Error("Usage unavailable");
        const snapshot = normalize(await response.json());
        if (controller.signal.aborted) return;
        display(snapshot);
        delay = isStale(snapshot) ? 15_000 : 5 * 60_000;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* Storage may be disabled. */ }
      } catch {
        if (!controller.signal.aborted) setStatus(last ? "STALE" : "UNAVAILABLE");
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) timer = setTimeout(refresh, delay);
      }
    };
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) display(normalize(JSON.parse(saved)));
      } catch { /* Invalid or unavailable storage must not prevent a network refresh. */ }
      void refresh();
    });
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", refresh); };
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
