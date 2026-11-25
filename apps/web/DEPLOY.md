# Deploying meb.terhubung.app

The site is a static export (`out/`) served by Vercel. Do these steps once.

## 1. Create the project

Vercel dashboard > Add New > Project > import the Git repository.

- Set **Root Directory** to `apps/web`.
- Framework preset: Next.js.
- Build command, output directory and install command: leave the defaults (`next build`; the static export in `out/` is detected).
- Node.js version: 24.x or the newest offered.
- No environment variables.

## 2. Keep it quiet

- Do not enable Web Analytics or Speed Insights (both add a script and requests).
- Do not add any integration.
- Leave "Vercel Toolbar" off for production.

## 3. Production branch

Set it to `main`. `vercel.json` sets `ignoreCommand` to `scripts/vercel-ignore.sh`, so commits that do not touch `apps/web` skip the build. The script fetches the last deployed commit when the shallow clone lacks it, and builds when it cannot tell. Keep Settings > Git > Ignored Build Step empty (a dashboard value overrides the file).

## 4. Add the domain

Project > Settings > Domains > add `meb.terhubung.app`.

## 5. DNS

At the DNS provider for `terhubung.app`, add one record:

- Type `CNAME`, name (host) `meb`, value `cname.vercel-dns.com.`, TTL 3600 (or automatic).
- If Vercel's Domains page shows a project-specific target instead (for example `xxxx.vercel-dns-017.com`), use the value Vercel shows.
- If the DNS is on Cloudflare, set the record to "DNS only" (grey cloud).
- Do not add an A record for `meb`.

Wait until the Domains page shows "Valid Configuration". Vercel then issues the HTTPS certificate by itself.

## 6. Verify after the first deploy

- `curl -sI https://meb.terhubung.app/privacy` returns `200`, a `content-security-policy` header and no `set-cookie` header.
- Open the three pages. In the browser's network panel every request goes to `meb.terhubung.app`.

## 7. Launch checklist

1. Terms reviewed (they are a draft).
2. In `src/config/site.ts`, replace `COMPANY_ADDRESS` (registered address) and `COMPANY_CITY` (city of the registered domicile, for the District Court) with the real values.
3. Screenshots captured, `npm run screenshots`, `ready: true` in `src/content/screenshots.ts`.
   Five are done (2026-11-17). `tip-jar` waits for the real store: capture it from a TestFlight build
   with sandbox prices once the three tips exist in App Store Connect (local StoreKit testing did not
   load prices in the Xcode-launched dev build), save it as `screenshots-src/tip-jar.png`, run
   `npm run screenshots` and set its `ready: true`.
4. `STORE_LINKS` filled in `src/config/site.ts`. The official badge files are in `public/badges/` (`app-store.svg`, `google-play.png`); do not alter or grey them out.
5. `npm run check:launch` passes. It fails while a placeholder, a "Coming soon" line, a null store link or a missing badge file remains.
6. In the app, set `PRIVACY_POLICY_URL` in `apps/mobile/src/about/links.ts` to `https://meb.terhubung.app/privacy` and use the same URL in App Store Connect and Play Console (mobile work, not part of the website). `site/privacy/index.html` is superseded and stays in the repo.
