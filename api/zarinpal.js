/**
 * Online payment through the Shetab gateway of ZarinPal (zarinpal.com), verified on the server.
 *   { action: 'create', callbackUrl } -> { authority, payUrl }   (send the user to payUrl)
 *   { action: 'verify', authority }   -> { credits, granted, refId }   (call after the gateway sends the user back)
 *
 * Vercel env: ZARINPAL_MERCHANT_ID (the 36-character code from your ZarinPal panel).
 *   If ZarinPal wants a fixed server IP (it does): run relay/zarinpal-relay.mjs on a machine with a fixed IP and set
 *   ZARINPAL_API_BASE (the relay's https address) and ZARINPAL_RELAY_SECRET (the same secret as the relay's RELAY_SECRET).
 *   For testing: ZARINPAL_SANDBOX=1 (any UUID-shaped merchant id works in the sandbox).
 * The money is settled by ZarinPal to the bank card/sheba you registered in YOUR ZarinPal panel; no card number is ever
 * needed in this code. Credits are added only after ZarinPal itself confirms the payment, and each payment once.
 */
import { createHmac } from 'node:crypto';
import { cmd } from './_lib/redis.js';
import { guard, body, originAllowed, PACK_CREDITS, PACK_PRICE_TOMAN } from './_lib/http.js';
import { authUser, creditsKey, grantPurchase } from './_lib/auth.js';

const sandbox = () => process.env.ZARINPAL_SANDBOX === '1';
const apiBase = () => process.env.ZARINPAL_API_BASE || (sandbox() ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com');
const payBase = () => process.env.ZARINPAL_PAY_BASE || (sandbox() ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com');
const merchant = () => process.env.ZARINPAL_MERCHANT_ID || '';
const AMOUNT_RIAL = () => PACK_PRICE_TOMAN * 10; // ZarinPal counts in Rial unless told otherwise

const safeUrl = (req, u) => {
  try { const o = new URL(u).origin; return originAllowed(req, o) ? u : null; } catch { return null; }
};

async function zp(name, payload) {
  const path = `/pg/v4/payment/${name}.json`;
  const body = JSON.stringify({ merchant_id: merchant(), ...payload });
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'ZarinPal Rest Api v4' };
  // When ZARINPAL_API_BASE points to our own relay on a fixed-IP machine (relay/zarinpal-relay.mjs), the call is signed with the shared secret
  const secret = process.env.ZARINPAL_RELAY_SECRET;
  if (secret) {
    const ts = String(Math.floor(Date.now() / 1000));
    headers['x-relay-ts'] = ts;
    headers['x-relay-sig'] = createHmac('sha256', secret).update(`${ts}.${path}.${body}`).digest('hex');
  }
  const r = await fetch(`${apiBase()}${path}`, { method: 'POST', headers, body });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, data: j.data && !Array.isArray(j.data) ? j.data : null, errors: j.errors };
}

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
    if (!merchant()) return res.status(503).json({ error: 'ZARINPAL_NOT_CONFIGURED' });
    const { action, authority } = body(req);

    if (action === 'create') {
      const callbackUrl = safeUrl(req, body(req).callbackUrl);
      if (!callbackUrl) return res.status(400).json({ error: 'Bad callback URL' });
      const r = await zp('request', {
        amount: AMOUNT_RIAL(),
        description: `آقای قاضی - ${PACK_CREDITS} تحلیل اختلاف`,
        callback_url: callbackUrl,
      });
      if (!r.data || r.data.code !== 100 || !r.data.authority) {
        console.error('zarinpal request failed:', JSON.stringify(r.errors || r.data));
        // zarinpalCode helps to find the cause (e.g. -10: merchant code or server IP not accepted); it contains no secrets
        return res.status(502).json({ error: 'ZARINPAL_CREATE_FAILED', zarinpalCode: r.errors?.code ?? r.data?.code ?? null });
      }
      await cmd('SET', `zp:${r.data.authority}`, user.uid, 'EX', 86400); // binds this payment to this account
      return res.status(200).json({ authority: r.data.authority, payUrl: `${payBase()}/pg/StartPay/${r.data.authority}` });
    }

    if (action === 'verify') {
      if (!/^[A-Za-z0-9]{10,64}$/.test(String(authority || ''))) return res.status(400).json({ error: 'Bad authority' });
      if ((await cmd('GET', `zp:${authority}`)) !== user.uid) return res.status(404).json({ error: 'UNKNOWN_PAYMENT' });

      // Redeem each payment once: whoever sets this flag first is allowed to add the credits.
      if ((await cmd('SET', `pay:zp:${authority}`, '1', 'NX')) !== 'OK') {
        return res.status(200).json({ credits: Number(await cmd('GET', creditsKey(user.uid))) || 0, granted: false });
      }
      try {
        const r = await zp('verify', { authority, amount: AMOUNT_RIAL() });
        // 100 = verified now, 101 = already verified earlier (e.g. a retry); both mean the money really arrived
        if (!r.data || ![100, 101].includes(r.data.code)) {
          throw Object.assign(new Error('Not paid'), { code: 'NOT_PAID', zarinpalCode: r.errors?.code ?? r.data?.code ?? null });
        }
        const credits = await grantPurchase(user.uid, PACK_CREDITS);
        return res.status(200).json({ credits, granted: true, refId: r.data.ref_id ?? null });
      } catch (e) {
        await cmd('DEL', `pay:zp:${authority}`); // allow a retry
        if (e.code === 'NOT_PAID') return res.status(402).json({ error: 'NOT_PAID', zarinpalCode: e.zarinpalCode ?? null });
        throw e;
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('zarinpal error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
