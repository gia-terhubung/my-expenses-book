# My Expenses Book: website

The public site at `https://meb.terhubung.app`: landing page, `/privacy` and `/terms`.
Next.js (App Router) exported as static files. No analytics, no cookies, no third-party requests at runtime.

- Spec: `../../docs/superpowers/specs/2026-11-17-web-landing-design.md`
- Plan: `../../docs/superpowers/plans/2026-11-17-web-landing.md`

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test           # Vitest: token contrast, CSS/token sync, component tests
npm run build      # static export to out/
```

Where things live:

- `src/config/site.ts`: site facts and `STORE_LINKS` (set the store URLs here at launch).
- `src/content/`: all copy (landing, privacy, terms) and the screenshot manifest.
- `src/theme/tokens.ts` and `src/app/globals.css`: the Ledger slip palette, kept in step by a test.
