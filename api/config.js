/**
 * Public settings for the app (nothing secret): which payment methods are switched on and the prices to show.
 * Works as POST { action: 'public' } (what the app does) and as a plain GET, so you can open  https://YOUR-SITE/api/config
 * in a browser to check your setup:
 *   { version, packCredits, freeCredits, prices: { usd, toman }, methods: { stripe, paypal, zarinpal },
 *     stripeMode: 'test' | 'live' | null, ready: { redis, gemini, email }, country }
 * `country` is the visitor's country (2 letters, from the hosting platform's header) or ''. The app uses it to offer ZarinPal
 * to visitors in Iran whatever language they chose; every other method is offered to everybody in every language.
 */
import { guard, PACK_CREDITS, PACK_PRICE_USD, PACK_PRICE_TOMAN, ANON_CREDITS } from './_lib/http.js';
import { stripeConfigured } from './_lib/stripe.js';
import { redisConfigured } from './_lib/redis.js';
import { emailConfigured } from './_lib/email.js';

export const APP_VERSION = 'global-3';

export default async function handler(req, res) {
  if (guard(req, res, { needRedis: false, allowGet: true })) return;
  const env = process.env;
  const country = String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '').toUpperCase();
  const key = env.STRIPE_SECRET_KEY || '';
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    version: APP_VERSION,
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    packCredits: PACK_CREDITS,
    freeCredits: ANON_CREDITS,
    prices: { usd: PACK_PRICE_USD, toman: PACK_PRICE_TOMAN },
    methods: {
      stripe: stripeConfigured(),
      paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
      ziball: !!env.ZIBAL_MERCHANT,
    },
    stripeMode: key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : key ? 'test' : null,
    ready: { redis: redisConfigured(), gemini: !!(env.GEMINI_API_KEY || env.FALLBACK_API_KEY), email: emailConfigured() },
  });
}
