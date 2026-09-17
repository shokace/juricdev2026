"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import CodexUsage from "@/components/codex-usage";
import AnthropicUsage from "@/components/anthropic-usage";

type Provider = "codex" | "claude";
export default function UsageDeck() {
  const [front, setFront] = useState<Provider>("codex");
  const [swapping, setSwapping] = useState(false);
  const [hint, setHint] = useState(false);
  const deck = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  const other = front === "codex" ? "claude" : "codex";

  useEffect(() => {
    const el = deck.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && window.matchMedia("(hover: none)").matches) {
        setHint(true);
        observer.disconnect();
      }
    }, { threshold: 0.55 });
    observer.observe(el);
    return () => { observer.disconnect(); if (timer.current) clearTimeout(timer.current); };
  }, []);

  function swap() {
    if (locked.current) return;
    setHint(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setFront(other); return; }
    locked.current = true;
    setSwapping(true);
    timer.current = setTimeout(() => {
      setFront(other);
      setSwapping(false);
      locked.current = false;
    }, 650);
  }

  return (
    <div ref={deck} className="usage-deck" data-front={front} data-swapping={swapping} data-hint={hint}
      onClick={event => {
        // Inert rear-card edges are hit-tested against the stack underneath.
        if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains("usage-stack")) swap();
      }}>
      <div className="usage-stack">
        {(["codex", "claude"] as const).map(provider => {
          const active = provider === front;
          return (
            <section key={provider} className={`hud-panel usage-card usage-card-${provider} ${active ? "usage-front" : "usage-back"}`}
              aria-hidden={!active} inert={!active} aria-label={`${provider === "codex" ? "Codex" : "Claude"} usage card`}
              onClick={event => {
                if (!active || (event.target as HTMLElement).closest("button, a, input, summary")) return;
                if (window.getSelection()?.toString()) return;
                swap();
              }}>
              <div className="panel-heading usage-card-heading">
                <h2>
                  <Image className={`usage-mark usage-mark-${provider}`} src={`/brands/${provider === "codex" ? "openai" : "anthropic"}.svg`}
                    width={provider === "codex" ? 22 : 28} height={22} alt="" aria-hidden="true" unoptimized />
                  {provider === "codex" ? "Codex Usage" : "Claude Usage"}
                </h2>
              </div>
              <div className="usage-card-body">
                {provider === "codex" ? <CodexUsage /> : <AnthropicUsage />}
              </div>
            </section>
          );
        })}
      </div>
      <button type="button" className="usage-swap" onClick={swap} aria-disabled={swapping} aria-label={`Show ${other === "claude" ? "Claude" : "Codex"} usage`}>
        <span className="usage-pagination" aria-hidden="true"><i className={front === "codex" ? "selected" : ""} /><i className={front === "claude" ? "selected" : ""} /></span>
        <span>Show {other === "claude" ? "Claude" : "Codex"}<span className="usage-swap-icon" aria-hidden="true"> ⇄</span></span>
      </button>
      <span className="sr-only" role="status">{front === "codex" ? "Codex" : "Claude"} usage is in front.</span>
    </div>
  );
}
