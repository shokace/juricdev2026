# Push & Deploy

Production: <https://juric.dev> — Cloudflare **Pages** project `juricdev2026`.

**The Pages project is direct-upload, not git-connected.** Pushing to `main` does *not*
deploy anything. Every release is a manual `wrangler pages deploy` from the local build
output. Push and deploy are two separate steps.

## Full release

```bash
# 1. sanity build (typecheck + lint via next)
npm run build

# 2. commit + push
git add -A && git commit -m "..." && git push origin main

# 3. build the Cloudflare Pages output -> .vercel/output/static
npx @cloudflare/next-on-pages@1

# 4. deploy (see the cwd gotcha below — must NOT run from the repo root)
COMMIT=$(git rev-parse HEAD)
cd /tmp && npx wrangler pages deploy /Users/ezkie/Repos/juricDev2026/.vercel/output/static \
  --project-name juricdev2026 \
  --branch main \
  --commit-hash "$COMMIT" \
  --commit-message "..."

# 5. verify the change is actually live
curl -s https://juric.dev | grep -o '<some string from the change>'
```

Wrangler prints a per-deploy preview URL (`https://<hash>.juricdev2026.pages.dev`);
`juric.dev` updates at the same time.

## Gotchas

- **Never run `wrangler pages deploy` from the repo root.** Wrangler auto-loads
  `.env.local`, whose `CLOUDFLARE_API_TOKEN` is a KV-scoped token with no Pages
  permission — the deploy dies with `Authentication error [code: 10000]`. `env -u
  CLOUDFLARE_API_TOKEN` does *not* help, because the value comes from the file, not the
  environment. Run from any directory without a `.env.local` (`/tmp`, the session
  scratchpad) and pass an absolute path to the output dir. From there wrangler falls back
  to the stored OAuth login in `~/Library/Preferences/.wrangler/config`.
- The deploy directory is `.vercel/output/static` (produced by `@cloudflare/next-on-pages`,
  which shells out to `vercel build`). `.vercel/` is gitignored; the `.vercel/project.json`
  ids are `"_"` placeholders on purpose and no Vercel account is involved.
- No CI: there are no GitHub Actions workflows and no Vercel/Pages git integration.
- `npm run build` alone is not a deployable artifact — step 3 is what Pages serves.

## ISS cron worker (separate deploy)

Only when `cloudflare/iss-cron/` changes. It is its own Worker, unrelated to the Pages
deploy above:

```bash
cd cloudflare/iss-cron && npx wrangler deploy
```

It hits `ISS_REFRESH_URL` (`https://juric.dev/api/iss`) every minute so the KV trail keeps
updating with no visitors. Runtime env vars (`KVTok`, `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_KV_NAMESPACE_ID_ISS`, the Anthropic/OpenAI admin keys) live in the Cloudflare
dashboard for the Pages project, not in the repo — see README for the KV setup.
