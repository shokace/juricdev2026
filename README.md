# Petar Juric — engineering portfolio

Production: <https://juric.dev>. Next.js on Cloudflare Pages (`juricdev2026`).
See [DEPLOY.md](DEPLOY.md) for the commit, push, build, and direct-upload release flow.
Pushing to GitHub does not deploy the site.

## Portfolio

The homepage is statically rendered; the Neverlanding project loads its live traffic
graph separately when scrolled into view. The hero introduces Petar's current
work deploying data systems at Apple (contract), and previous work on real-time
5G and 6G systems at Ericsson. Below it, Sefaly is the highlighted
project, followed by Nullspeak, FAFR, FXBViewer, Neverlanding.page, and Starlink
Tracker under Other projects. Nullspeak is presented as a visual speech recognition
prototype; FAFR covers Fourier audio encoding, reconstruction, and equation export.
Both link to their source repositories. Employment details are limited to information supplied by Petar.
His headshot is hosted locally with explicit dimensions.

Motion is progressive enhancement: a short hero entrance, one-time section
reveals, and hover/focus accents. Reduced-motion preferences disable animation,
and all content remains readable without JavaScript and when printing.

The ISS globe, animated background, activity feed, live visitor dashboard, and audio
upload demo are retired from the homepage. The legacy modules and API routes remain
available in the repository; the ISS refresh worker has no scheduled triggers.
The KV namespace is shared with usage reporting and must not be deleted.

```sh
npm run dev
npm run lint
npm run build
```

## Neverlanding traffic

A small footer-style note under Neverlanding shows its rolling 30-day request
count beside a 64 × 20 px sparkline of daily traffic. It refreshes every minute
while near the viewport and pauses in background tabs. The source and update time
are available in the hover text and accessible label. Requests include all HTTP
traffic, not unique visitors; sampled counts retain the approximate symbol.
The first and last days may be partial.

`/api/neverlanding/stats` uses server-only `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ZONE_ID` settings already configured in Pages. The GraphQL query filters
to `neverlanding.page` and `www.neverlanding.page`, excludes internal Cloudflare
requests, and returns only aggregate counts and timestamps. Concurrent requests
are coalesced and successful results cached for one minute per edge instance,
with a one-minute shared-cache header. Provider reporting may lag.

Missing or failed analytics never become fabricated zero traffic. The browser
keeps the last good sparkline during a refresh failure, labels it delayed, and
retains the original update time in its label. A first-load failure shows a short
unavailable message.

```sh
npm run test:neverlanding
```

## Usage page

The account summaries now live at `/usage`, linked discreetly in the portfolio
footer. They render in plain side-by-side panels and stack on mobile. This page is
excluded from search indexing. The homepage does not mount or fetch these tools.
Links between the two pages use native browser navigation, avoiding client-side
route-prefetch compatibility issues with the current Cloudflare Pages adapter.

### Codex

`/api/codex/usage` returns an allowlisted Cloudflare KV summary. The local sync script
uses the official app-server `account/usage/read` method and reflects Codex account
activity, not API organization billing. Only aggregate metrics and daily token
counts are uploaded; credentials, account identifiers, prompts, and session content
stay local.

Requires Node 20.12+, an authenticated Codex CLI with `account/usage/read`, and local
`.env.local` settings `KVTok`, `CLOUDFLARE_ACCOUNT_ID`, and
`CLOUDFLARE_KV_NAMESPACE_ID_ISS`. An optional `CLOUDFLARE_KV_NAMESPACE_ID_CODEX`
overrides the namespace. The key is `codex:account-usage:v1`.

```sh
npm run test:codex
npm run sync:codex -- --dry-run
npm run sync:codex
npm run sync:codex:install
```

Install the background sync from this permanent checkout. It runs at login and
every 15 minutes while the Mac is awake. Logs live in
`~/Library/Logs/dev.juric.codex-usage/`. The panel polls every minute and marks data
over an hour old as stale. Provider reporting can lag behind actual activity.

### Anthropic

`/api/anthropic/usage` uses server-only `ANTHROPIC_ADMIN_KEY` and
`ANTHROPIC_USAGE_START_DATE` settings. It aggregates paginated token and USD cost
reports and removes organization, workspace, and key identifiers. It reports API
usage, not a Claude subscription. Unavailable cost stays blank.

Successful reports are fresh for one hour. Expired reports are served immediately
while Next's `after` keeps the background refresh alive. Concurrent refreshes are
coalesced per edge instance; failed refreshes back off for a minute. The last good
snapshot persists at `anthropic:api-usage:v1` in the same KV namespace.

The browser restores a validated public summary from local storage, then fetches
the endpoint. It polls stale reports after 15 seconds and fresh reports after five
minutes. Invalid or disabled storage does not prevent network loading.

```sh
npm run test:anthropic
# After the Cloudflare build:
npm run test:anthropic:edge
```

The edge check exercises the actual deployment bundle with mocked services to
verify that expired data returns immediately and refresh/persistence finish after
the response. It does not use credentials or contact upstream services.
