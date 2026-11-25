/**
 * Public settings for the app (nothing secret): payment methods, prices and service readiness.
 * The same endpoint supports POST { action: 'public' } and a plain GET for diagnostics.
 */
import { guard, PACK_CREDITS, PACK_PRICE_USD, PACK_PRICE_TOMAN, ANON_CREDITS } from './_lib/http.js';
import { stripeConfigured } from './_lib/stripe.js';
import { redisConfigured } from './_lib/redis.js';
import { emailConfigured } from './_lib/email.js';

export const APP_VERSION = 'global-5';

const manualPaymentUrl = () => {
  const value = String(process.env.MANUAL_PAY_URL || '').trim();
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

export default async function handler(req, res) {
  if (guard(req, res, { needRedis: false, allowGet: true })) return;
  const env = process.env;
  const country = String(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || '').toUpperCase();
  const key = env.STRIPE_SECRET_KEY || '';
  const linkUrl = manualPaymentUrl();
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
      zibal: !!env.ZIBAL_MERCHANT,
      link: !!(env.ADMIN_SECRET && linkUrl),
    },
    linkUrl: env.ADMIN_SECRET && linkUrl ? linkUrl : '',
    stripeMode: key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : key ? 'test' : null,
    ready: { redis: redisConfigured(), gemini: !!(env.GEMINI_API_KEY || env.FALLBACK_API_KEY), email: emailConfigured() },
  });
}
