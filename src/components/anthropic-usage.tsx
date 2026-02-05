"use client";

import { useEffect, useState } from "react";

type UsageTotals = {
  input_tokens: number;
  output_tokens: number;
  cached_read_tokens: number;
  cached_creation_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  updated_at: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AnthropicUsage() {
  const [usage, setUsage] = useState<UsageTotals | null>(null);
  const [status, setStatus] = useState<"LIVE" | "ERROR">("ERROR");

  useEffect(() => {
    let isMounted = true;

    const fetchUsage = async () => {
      try {
        const response = await fetch("/api/anthropic/usage");
        if (!response.ok) {
          if (isMounted) setStatus("ERROR");
          return;
        }
        const payload = (await response.json()) as UsageTotals;
        if (isMounted) {
          setUsage(payload);
          setStatus("LIVE");
        }
      } catch {
        if (isMounted) setStatus("ERROR");
      }
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 5 * 60 * 1000); // Check every 5 minutes
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-3 text-[0.72rem] uppercase tracking-[0.2em] text-muted">
      <div className="flex items-center justify-between">
        <span>Input Tokens</span>
        <span className="text-[color:var(--text0)]">
          {usage ? formatNumber(usage.input_tokens) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Output Tokens</span>
        <span className="text-[color:var(--text0)]">
          {usage ? formatNumber(usage.output_tokens) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Total Tokens</span>
        <span className="text-[color:var(--text0)]">
          {usage ? formatNumber(usage.total_tokens) : "--"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Total Cost</span>
        <span className="text-[color:var(--accent-green)]">
          {usage ? `$${usage.total_cost_usd.toFixed(2)}` : "--"}
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
