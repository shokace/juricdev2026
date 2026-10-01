"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const endpoint = "https://resume.juric.dev";
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

let turnstileScript: Promise<void> | undefined;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScript) {
    turnstileScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { script.remove(); turnstileScript = undefined; reject(new Error("Security check unavailable")); };
      document.head.appendChild(script);
    });
  }
  return turnstileScript;
}

export default function ResumeRequest() {
  const section = useRef<HTMLElement>(null);
  const challenge = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const submitting = useRef(false);
  const [config, setConfig] = useState<"loading" | "ready" | "unavailable">("loading");
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let started = false;
    const controller = new AbortController();
    async function initialize() {
      if (started) return;
      started = true;
      try {
        const response = await fetch(`${endpoint}/config`, { signal: controller.signal, credentials: "omit", cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.available || typeof data.siteKey !== "string") throw new Error("Unavailable");
        await loadTurnstile();
        if (!active || !challenge.current) return;
        if (!window.turnstile) throw new Error("Security check unavailable");
        widget.current = window.turnstile.render(challenge.current, {
          sitekey: data.siteKey, action: "resume_request", theme: "light", size: "flexible",
          callback: (value: string) => { if (active) setToken(value); },
          "expired-callback": () => { if (active) setToken(""); },
          "error-callback": () => {
            if (active) { setToken(""); setState("error"); setMessage("The security check could not load. Please reload this page and try again."); }
          },
        });
        setConfig("ready");
      } catch {
        if (active) setConfig("unavailable");
      }
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { void initialize(); observer.disconnect(); }
    }, { rootMargin: "160px" });
    if (section.current) observer.observe(section.current);
    return () => {
      active = false;
      controller.abort();
      observer.disconnect();
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !token || config !== "ready") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    submitting.current = true;
    let accepted = false;
    setState("sending");
    setMessage("");
    try {
      const response = await fetch(`${endpoint}/request`, {
        method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), consent: data.get("consent") === "on", website: data.get("website"), turnstileToken: token }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send your request. Please try again later.");
      accepted = true;
      setState("sent");
      setMessage("Check your inbox. Your resume email is queued, with the PDF attached. It may take a few minutes; check your spam folder too.");
      form.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
        ? error.message : "We could not confirm your request. Check your inbox before trying again.");
    } finally {
      submitting.current = false;
      setToken("");
      if (!accepted && widget.current && window.turnstile) window.turnstile.reset(widget.current);
    }
  }

  return (
    <section id="resume" ref={section} className="resume-section" aria-labelledby="resume-title">
      <div className="resume-intro">
        <p className="eyebrow">Experience & qualifications</p>
        <h2 id="resume-title">My resume, in your inbox.</h2>
        <p>Leave your email and I’ll send you a PDF copy. Use your personal, work, or university address.</p>
      </div>
      <form className="resume-form" onSubmit={submit} aria-busy={state === "sending"}>
        <fieldset disabled={config !== "ready" || state === "sending" || state === "sent"}>
          <label htmlFor="resume-email">Email address</label>
          <input id="resume-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} placeholder="you@company.com" required aria-describedby="resume-privacy resume-status" />
          <div className="resume-honeypot" aria-hidden="true">
            <label htmlFor="resume-website">Website</label>
            <input id="resume-website" name="website" type="text" autoComplete="off" tabIndex={-1} />
          </div>
          <label className="resume-consent">
            <input type="checkbox" name="consent" required />
            <span id="resume-privacy">I agree to my email and request being stored to send the resume and prevent abuse. This does not subscribe me to a mailing list.</span>
          </label>
          <div ref={challenge} className="resume-challenge" />
          <button className="resume-submit" type="submit" disabled={!token}>
            {state === "sending" ? "Sending…" : state === "sent" ? "Request received" : "Email me the resume"}
          </button>
        </fieldset>
        <div id="resume-status" className={`resume-status${state === "error" ? " resume-error" : ""}`} role="status" aria-live="polite">
          {config === "loading" && "Loading the request form…"}
          {config === "unavailable" && <><span>Resume requests are temporarily unavailable. Please try again later.</span>{" "}<button type="button" className="text-link" onClick={() => { setConfig("loading"); setAttempt(value => value + 1); }}>Retry</button></>}
          {config === "ready" && message}
        </div>
        <noscript><p>Please enable JavaScript to request a resume by email.</p></noscript>
      </form>
    </section>
  );
}
