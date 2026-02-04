"use client";

import { useEffect, useState } from "react";

type UsageTotals = {
  requests: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  updated_at: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function OpenAIUsage() {
  const [usage, setUsage] = useState<UsageTotals | null>(null);
  const [status, setStatus] = useState<"LIVE" | "ERROR">("ERROR");

  useEffect(() => {
    let isMounted = true;

    const fetchUsage = async () => {
      try {
        const response = await fetch("/api/openai/usage");
        if (!response.ok) {
          if (isMounted) {
            setStatus("ERROR");
          }
          return;
        }
        const payload = (await response.json()) as UsageTotals;
        if (isMounted) {
          setUsage(payload);
          setStatus("LIVE");
        }
      } catch {
        if (isMounted) {
          setStatus("ERROR");
        }
      }
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-3 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
      <div className="flex items-center justify-between">
        <span>Requests</span>
        <span className="text-[color:var(--text0)]">
          {usage ? formatNumber(usage.requests) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Total Tokens</span>
        <span className="text-[color:var(--text0)]">
          {usage ? formatNumber(usage.tokens) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Cached Tokens</span>
        <span className="text-[color:var(--text0)]">
          {usage ? formatNumber(usage.cached_tokens) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Status</span>
        <span
          className={
            status === "LIVE"
              ? "text-[color:var(--accent-green)]"
              : "text-[color:var(--accent-red)]"
          }
        >
          {status}
        </span>
      </div>
    </div>
  );
}
