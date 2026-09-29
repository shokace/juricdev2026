import type { Metadata } from "next";
import Link from "next/link";
import AnthropicUsage from "@/components/anthropic-usage";
import CodexUsage from "@/components/codex-usage";

export const metadata: Metadata = {
  title: "Usage | Petar Juric",
  description: "Personal Codex account and Anthropic API usage summaries.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/usage" },
  openGraph: { title: "Usage | Petar Juric", description: "Personal Codex account and Anthropic API usage summaries.", url: "https://juric.dev/usage" },
};

export default function UsagePage() {
  return (
    <div className="portfolio usage-page">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <Link className="wordmark" href="/">juric.dev</Link>
        <nav aria-label="Main navigation"><Link href="/">Back to portfolio</Link></nav>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="usage-heading"><h1>Usage</h1><p>Personal account and API activity. These summaries reflect provider reporting, which can be delayed.</p></div>
        <div className="usage-panels">
          <section className="usage-panel" aria-labelledby="codex-heading"><h2 id="codex-heading">Codex</h2><p>Account usage</p><CodexUsage /></section>
          <section className="usage-panel" aria-labelledby="anthropic-heading"><h2 id="anthropic-heading">Anthropic</h2><p>API usage</p><AnthropicUsage /></section>
        </div>
      </main>
      <footer className="site-footer"><p>Petar Juric <span aria-hidden="true">/</span> Software engineer</p><Link href="/">Back to portfolio</Link></footer>
    </div>
  );
}
