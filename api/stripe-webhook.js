/**
 * Stripe webhook: adds the credits even if the buyer closes the page before coming back to the site.
 * In Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *   URL    https://YOUR-SITE/api/stripe-webhook
 *   Events checkout.session.completed and checkout.session.async_payment_succeeded
 * and put the "Signing secret" (whsec_…) into the Vercel variable STRIPE_WEBHOOK_SECRET.
 * Every call is checked with Stripe's signature, so nobody can fake a payment by calling this URL.
 */
import { cmd } from './_lib/redis.js';
import { guard } from './_lib/http.js';
import { creditsKey } from './_lib/auth.js';
import { isPaidPack, redeemSession, verifyWebhookSignature } from './_lib/stripe.js';

export const config = { api: { bodyParser: false } }; // the signature needs the exact raw body

async function rawBody(req) {
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) return String(req.rawBody);
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (guard(req, res)) return;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'WEBHOOK_NOT_CONFIGURED' });
  try {
    const raw = await rawBody(req);
    if (!verifyWebhookSignature(raw, req.headers['stripe-signature'], secret)) return res.status(400).json({ error: 'BAD_SIGNATURE' });
    const event = JSON.parse(raw);
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      return res.status(200).json({ received: true, ignored: true });
    }
    const session = event.data?.object;
    const uid = session?.metadata?.uid;
    // only for a real account of ours, a fully paid session and exactly our price
    if (!uid || !isPaidPack(session) || (await cmd('GET', creditsKey(uid))) === null) return res.status(200).json({ received: true, ignored: true });
    const r = await redeemSession(uid, session);
    return res.status(200).json({ received: true, granted: r.granted });
  } catch (e) {
    console.error('stripe webhook error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' }); // Stripe will retry
  }
}
