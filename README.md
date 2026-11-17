# Mr Judge / آقای قاضی

AI dispute-analysis app you can sell: first 2 analyses free, then credit packs. **One folder, one website address:** the Android app is a thin shell that opens the website, so changing the site changes the app.

- **Languages:** English, فارسی, العربية, Türkçe, Deutsch, Français, Español, Русский (`src/locales`), each with its own address (`/en/`, `/de/`, `/fa/` …), real pages per language, sitemap and hreflang.
- **Payments:** PayPal (and Stripe: cards, Apple Pay, Google Pay) outside Iran; **Zibal** (Shetab cards) for visitors in Iran or reading Persian, called through a static-IP proxy (Fixie, `FIXIE_URL`) or your own relay (`relay/`); Cafe Bazaar billing inside the Android app; an optional hand-confirmed payment link (`/admin.html`, off by default).
- **Server (`api/`):** anonymous accounts, credits, optional email sign-in, every payment verified with the provider; AI = Gemini with automatic fallback to Groq / xAI Grok.
- **Hosting:** Vercel (now) or Cloudflare Pages (`functions/`, built-in D1 database) or a Cloudflare Worker (`cloudflare/wrangler.worker.jsonc`).
- **Android:** `capacitor.config.ts` + `android-www/`; needs `SITE_URL` (see راهنما.md, section 4).
- The Persian page carries the Enamad trust seal (`src/lib/enamad.js`).
- Tests (mock Stripe / PayPal / Zibal / proxy / Bazaar / Gemini / Groq, all languages): `npm test`.

Everything — setup, prices, the Android app, moving to a new address — is in **راهنما.md**.
Not yet tested against the live payment, proxy and AI services or on a real device.
