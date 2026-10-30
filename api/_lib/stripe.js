import { createHmac, timingSafeEqual } from 'node:crypto';
import { cmd } from './redis.js';
import { PACK_CREDITS, PACK_PRICE_USD } from './http.js';
import { grantPurchase, creditsKey } from './auth.js';

/** Stripe settings and the one function that turns a PAID checkout session into credits (used by the page and the webhook). */
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
export const stripeBase = () => process.env.STRIPE_API_BASE || 'https://api.stripe.com';
export const priceCents = () => Math.round(Number(PACK_PRICE_USD) * 100);

export async function stripeGet(path) {
  const r = await fetch(`${stripeBase()}${path}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

/** True only if this Stripe session is fully paid, for exactly one pack, in dollars. */
export const isPaidPack = (s) =>
  s?.status === 'complete' && s?.payment_status === 'paid' && s?.currency === 'usd' && s?.amount_total === priceCents();

/**
 * Adds the credits for a paid session once. `uid` must be the account the session was created for.
 * @returns {Promise<{granted:boolean, credits:number}>}
 */
export async function redeemSession(uid, session) {
  if ((await cmd('SET', `pay:stripe:${session.id}`, '1', 'NX')) !== 'OK') {
    return { granted: false, credits: Number(await cmd('GET', creditsKey(uid))) || 0 };
  }
  try {
    return { granted: true, credits: await grantPurchase(uid, PACK_CREDITS) };
  } catch (e) {
    await cmd('DEL', `pay:stripe:${session.id}`); // allow a retry
    throw e;
  }
}

/** Checks the "Stripe-Signature" header of a webhook (HMAC-SHA256 over "timestamp.payload", 5 minute tolerance). */
export function verifyWebhookSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = String(header || '').split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(nowSeconds - Number(t)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return sigs.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
