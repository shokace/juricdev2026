"use client";

import { useState } from "react";
import { buildCodexHeatmap } from "@/lib/codex-usage.mjs";

const number = new Intl.NumberFormat("en-US");
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export default function CodexUsageMap({ dailyUsage, updatedAt }: {
  dailyUsage: { date: string; tokens: number }[] | null;
  updatedAt: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const cells = buildCodexHeatmap(dailyUsage ?? [], updatedAt);
  const latest = cells.findLast((cell) => !cell.future)!;
  const active = cells.find((cell) => cell.date === selected) ?? latest;
  const dateLabel = dayLabel.format(new Date(active.date));
  const months = cells.filter((_, index) => index % 7 === 0).map((cell, index, weeks) => {
    const month = cell.date.slice(0, 7);
    // Don't crowd the first label when the view starts at the end of a month.
    if (index === 0 && weeks[1]?.date.slice(0, 7) !== month) return "";
    return index === 0 || month !== weeks[index - 1].date.slice(0, 7)
      ? monthLabel.format(new Date(cell.date)) : "";
  });

  return (
    <div className="codex-map border-t border-[color:var(--border)] pt-4">
      <div className="mb-3 flex items-center justify-between gap-2 text-[0.6rem] tracking-normal">
        <h3 className="text-[color:var(--text0)]">Usage Map</h3>
        <span className="text-faint">16 weeks</span>
      </div>
      {dailyUsage === null ? (
        <p className="py-6 text-[0.6rem] tracking-[0.08em] text-faint">Daily activity unavailable.</p>
      ) : (
        <>
          <div className="mb-1.5 grid grid-cols-16 gap-[3px] text-[0.5rem] tracking-normal text-faint" aria-hidden="true">
            {months.map((month, index) => <span key={index} className="overflow-visible">{month}</span>)}
          </div>
          <div className="grid grid-flow-col grid-cols-16 grid-rows-7 gap-[3px]" role="group" aria-label="Codex daily token usage over the last 16 weeks. Use arrow keys to explore days.">
            {cells.map((cell, index) => cell.future ? (
              <span key={cell.date} className="aspect-square" aria-hidden="true" />
            ) : (
              <button
                key={cell.date}
                type="button"
                className={`gh-cell gh-level-${cell.level} cursor-pointer rounded-[1px] transition-[box-shadow] hover:ring-1 hover:ring-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
                title={`${dayLabel.format(new Date(cell.date))}: ${number.format(cell.tokens)} tokens`}
                aria-label={`${dayLabel.format(new Date(cell.date))}: ${number.format(cell.tokens)} tokens`}
                aria-pressed={cell.date === active.date}
                tabIndex={cell.date === active.date ? 0 : -1}
                onMouseEnter={() => setSelected(cell.date)}
                onFocus={() => setSelected(cell.date)}
                onClick={() => setSelected(cell.date)}
                onKeyDown={(event) => {
                  const offset = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
                  if (offset === undefined) return;
                  event.preventDefault();
                  const next = Math.max(0, Math.min(cells.indexOf(latest), index + offset));
                  const buttons = event.currentTarget.parentElement?.querySelectorAll("button");
                  buttons?.[next]?.focus();
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[0.5rem] tracking-[0.08em] text-faint">
            <span>Daily tokens</span>
            <span className="flex items-center gap-1" aria-label="Darker green means fewer tokens; brighter green means more tokens.">
              Less {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`gh-level-${level} h-2 w-2 rounded-[1px]`} aria-hidden="true" />)} More
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[0.55rem] tracking-[0.06em]" aria-live="polite" aria-atomic="true">
            <span className="text-faint">{dateLabel}</span>
            <span className="text-[color:var(--accent-green)]">{number.format(active.tokens)} tokens</span>
          </div>
        </>
      )}
    </div>
  );
}
