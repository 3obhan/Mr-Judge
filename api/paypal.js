/**
 * PayPal checkout (website only), verified on the server.
 *   { action: 'create', returnUrl, cancelUrl } -> { orderId, approveUrl }   (send the user to approveUrl)
 *   { action: 'capture', orderId }             -> { credits, granted }      (call after PayPal sends the user back)
 *
 * Vercel env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, optional PAYPAL_ENV=sandbox (default: live).
 * Credits are added only after PayPal itself says the money was captured, and each order can be redeemed once.
 */
import { cmd } from './_lib/redis.js';
import { guard, body, originAllowed, PACK_CREDITS, PACK_PRICE_USD } from './_lib/http.js';
import { authUser, creditsKey, grantPurchase } from './_lib/auth.js';

const apiBase = () =>
  process.env.PAYPAL_API_BASE ||
  (process.env.PAYPAL_ENV === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com');

async function accessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw Object.assign(new Error('PayPal is not configured'), { code: 'PAYPAL_NOT_CONFIGURED' });
  const r = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`PayPal auth failed (${r.status})`);
  return j.access_token;
}

/** True only if this PayPal order object is fully paid for exactly one pack. */
function isPaidPack(order) {
  if (order?.status !== 'COMPLETED') return false;
  const cap = order?.purchase_units?.[0]?.payments?.captures?.[0];
  return !!cap && cap.status === 'COMPLETED' && cap.amount?.currency_code === 'USD' && cap.amount?.value === PACK_PRICE_USD;
}

const safeUrl = (req, u) => {
  try { const o = new URL(u).origin; return originAllowed(req, o) ? u : null; } catch { return null; }
};

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
    const { action, orderId } = body(req);

    if (action === 'create') {
      const b = body(req);
      const returnUrl = safeUrl(req, b.returnUrl);
      const cancelUrl = safeUrl(req, b.cancelUrl);
      if (!returnUrl || !cancelUrl) return res.status(400).json({ error: 'Bad return URL' });
      const token = await accessToken();
      const r = await fetch(`${apiBase()}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            custom_id: user.uid,
            description: `Mr Judge - ${PACK_CREDITS} dispute analyses`,
            amount: { currency_code: 'USD', value: PACK_PRICE_USD },
          }],
          payment_source: { paypal: { experience_context: {
            brand_name: 'Mr Judge', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl, cancel_url: cancelUrl,
          } } },
        }),
      });
      const order = await r.json().catch(() => ({}));
      const link = (order.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
      if (!r.ok || !order.id || !link) return res.status(502).json({ error: 'PAYPAL_CREATE_FAILED' });
      await cmd('SET', `po:${order.id}`, user.uid, 'EX', 86400); // binds this order to this account
      return res.status(200).json({ orderId: order.id, approveUrl: link.href });
    }

    if (action === 'capture') {
      if (!/^[A-Za-z0-9_-]{5,64}$/.test(String(orderId || ''))) return res.status(400).json({ error: 'Bad order' });
      if ((await cmd('GET', `po:${orderId}`)) !== user.uid) return res.status(404).json({ error: 'UNKNOWN_ORDER' });

      // Redeem each order once: whoever sets this flag first is allowed to add the credits.
      const first = await cmd('SET', `pay:paypal:${orderId}`, '1', 'NX');
      if (first !== 'OK') {
        return res.status(200).json({ credits: Number(await cmd('GET', creditsKey(user.uid))) || 0, granted: false });
      }
      try {
        const token = await accessToken();
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        let order = await (await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers })).json().catch(() => ({}));
        if (!isPaidPack(order)) {
          // e.g. already captured by an earlier attempt: ask PayPal for the order's real state
          order = await (await fetch(`${apiBase()}/v2/checkout/orders/${orderId}`, { headers })).json().catch(() => ({}));
        }
        if (!isPaidPack(order)) throw Object.assign(new Error('Not paid'), { code: 'NOT_PAID' });
        const credits = await grantPurchase(user.uid, PACK_CREDITS);
        return res.status(200).json({ credits, granted: true });
      } catch (e) {
        await cmd('DEL', `pay:paypal:${orderId}`); // allow a retry
        if (e.code === 'NOT_PAID') return res.status(402).json({ error: 'NOT_PAID' });
        throw e;
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('paypal error:', e);
    return res.status(e.code === 'PAYPAL_NOT_CONFIGURED' ? 503 : 500).json({ error: e.code || 'SERVER_ERROR' });
  }
}
