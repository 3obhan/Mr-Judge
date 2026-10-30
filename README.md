# Mr Judge – Global (8 languages, many ways to pay)

AI dispute-analysis app you can sell: first 2 analyses free, then credit packs.

- **Languages:** English, فارسی, العربية, Türkçe, Deutsch, Français, Español, Русский (`src/locales`, add more in minutes). Every language has its own address: `/en/`, `/de/`, `/fa/` … (real pages per language, sitemap and hreflang with `VITE_SITE_URL`).
- **Payments (website):** Stripe Checkout (cards, **Apple Pay**, **Google Pay**) and PayPal in every language; ZarinPal (Iranian Shetab cards) for visitors in Iran or reading Persian. Cafe Bazaar for an Android app in Iran.
- **Hosting:** Vercel **or** Cloudflare Workers (`wrangler.jsonc`, `cloudflare/`; built-in database, nothing else to sign up for).
- **Server (`api/`):** anonymous accounts, credits, email sign-in, every payment verified with the provider (Stripe also by webhook).
- **AI:** Gemini, with automatic fallback to Groq / xAI Grok when Gemini cannot answer.
- Tests (mock Stripe/PayPal/ZarinPal/Bazaar/Gemini/Groq, all languages): `npm test`.

Setup, prices, taxes and everything else: **راهنما.md**.
Not yet tested against the live Stripe / PayPal / ZarinPal / Bazaar / Gemini / Groq services or on a real device.
