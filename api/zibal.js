/**
 * Online payment through the Shetab gateway of Zibal (zibal.ir), verified on the server.
 *   { action: 'create', callbackUrl } -> { trackId, payUrl }          (send the user to payUrl)
 *   { action: 'verify', trackId }     -> { credits, granted, refNumber }   (call after the gateway sends the user back)
 *
 * Vercel / Cloudflare env: ZIBAL_MERCHANT (your merchant code from the Zibal panel; the test code "zibal" simulates payments).
 *   If Zibal answers with result 115 ("IP is not registered"), give the server a fixed outbound IP and register that IP in the Zibal panel. Two ways:
 *   (a) a static-IP proxy service such as Fixie: set FIXIE_URL (see api/_lib/gatewayFetch.js);
 *   (b) your own relay (relay/payment-relay.mjs): set ZIBAL_API_BASE (its https address + /zibal) and ZIBAL_RELAY_SECRET.
 * Credits are added only after Zibal itself confirms the payment (and its amount), and each payment once.
 */
import { createHmac } from 'node:crypto';
import { cmd } from './_lib/redis.js';
import { guard, body, originAllowed, PACK_CREDITS, PACK_PRICE_TOMAN } from './_lib/http.js';
import { authUser, creditsKey, grantPurchase } from './_lib/auth.js';
import { gatewayFetch } from './_lib/gatewayFetch.js';

const apiBase = () => String(process.env.ZIBAL_API_BASE || 'https://gateway.zibal.ir').replace(/\/$/, '');
const payBase = () => String(process.env.ZIBAL_PAY_BASE || 'https://gateway.zibal.ir').replace(/\/$/, '');
const merchant = () => process.env.ZIBAL_MERCHANT || '';
const AMOUNT_RIAL = () => PACK_PRICE_TOMAN * 10; // Zibal counts in Rial

const safeUrl = (req, u) => {
  try { const o = new URL(u).origin; return originAllowed(req, o) ? u : null; } catch { return null; }
};

async function zb(path, payload) {
  const text = JSON.stringify({ merchant: merchant(), ...payload });
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const secret = process.env.ZIBAL_RELAY_SECRET; // calls through our own relay on a fixed-IP machine are signed
  if (secret) {
    const ts = String(Math.floor(Date.now() / 1000));
    const relayPath = new URL(`${apiBase()}${path}`).pathname; // the path as the relay sees it
    headers['x-relay-ts'] = ts;
    headers['x-relay-sig'] = createHmac('sha256', secret).update(`${ts}.${relayPath}.${text}`).digest('hex');
  }
  const r = await gatewayFetch(`${apiBase()}${path}`, { method: 'POST', headers, body: text }); // through the static-IP proxy when FIXIE_URL is set
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
    if (!merchant()) return res.status(503).json({ error: 'ZIBAL_NOT_CONFIGURED' });
    const { action, trackId } = body(req);

    if (action === 'create') {
      const callbackUrl = safeUrl(req, body(req).callbackUrl);
      if (!callbackUrl) return res.status(400).json({ error: 'Bad callback URL' });
      const orderId = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
      const { data } = await zb('/v1/request', {
        amount: AMOUNT_RIAL(), callbackUrl, orderId, description: `Mr Judge - ${PACK_CREDITS} dispute analyses`,
      });
      if (data?.result !== 100 || !data?.trackId) {
        // result 115 = the IP of this server is not registered in the Zibal panel; it contains no secrets
        console.error('zibal request failed:', JSON.stringify({ result: data?.result, message: data?.message }));
        return res.status(502).json({ error: 'ZIBAL_CREATE_FAILED', zibalCode: data?.result ?? null });
      }
      await cmd('SET', `zb:${data.trackId}`, JSON.stringify({ uid: user.uid, orderId }), 'EX', 86400); // binds this payment to this account
      return res.status(200).json({ trackId: String(data.trackId), payUrl: `${payBase()}/start/${data.trackId}` });
    }

    if (action === 'verify') {
      if (!/^\d{1,18}$/.test(String(trackId || ''))) return res.status(400).json({ error: 'Bad trackId' });
      const bound = JSON.parse((await cmd('GET', `zb:${trackId}`)) || 'null');
      if (!bound || bound.uid !== user.uid) return res.status(404).json({ error: 'UNKNOWN_PAYMENT' });

      // Redeem each payment once: whoever sets this flag first is allowed to add the credits.
      if ((await cmd('SET', `pay:zb:${trackId}`, '1', 'NX')) !== 'OK') {
        return res.status(200).json({ credits: Number(await cmd('GET', creditsKey(user.uid))) || 0, granted: false });
      }
      try {
        const { data } = await zb('/v1/verify', { trackId: Number(trackId) });
        // result 100 = verified now, 201 = already verified earlier (a retry); both mean the money really arrived, in our amount
        const paid = (data?.result === 100 || data?.result === 201) && (data?.amount === undefined || Number(data.amount) === AMOUNT_RIAL())
          && (data?.orderId === undefined || data.orderId === bound.orderId);
        if (!paid) throw Object.assign(new Error('Not paid'), { code: 'NOT_PAID', zibalCode: data?.result ?? null });
        const credits = await grantPurchase(user.uid, PACK_CREDITS);
        return res.status(200).json({ credits, granted: true, refNumber: data.refNumber ?? null });
      } catch (e) {
        await cmd('DEL', `pay:zb:${trackId}`); // allow a retry
        if (e.code === 'NOT_PAID') return res.status(402).json({ error: 'NOT_PAID', zibalCode: e.zibalCode ?? null });
        throw e;
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('zibal error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
