/**
 * Zibal payment gateway
 *   { action: 'create', callbackUrl } -> { trackId, payUrl }
 *   { action: 'verify', trackId }     -> { credits, granted, refNumber }
 */
import { ProxyAgent } from 'undici';
import { cmd } from './_lib/redis.js';
import { guard, body, originAllowed, PACK_CREDITS, PACK_PRICE_TOMAN } from './_lib/http.js';
import { authUser, creditsKey, grantPurchase } from './_lib/auth.js';

const merchant = () => process.env.ZIBAL_MERCHANT || '';
const amountRial = () => PACK_PRICE_TOMAN * 10;
const apiBase = () => process.env.ZIBAL_API_BASE || 'https://gateway.zibal.ir';
const proxyAgent = process.env.FIXIE_URL ? new ProxyAgent(process.env.FIXIE_URL) : undefined;

const safeUrl = (req, value) => {
  try {
    const url = new URL(value);
    return originAllowed(req, url.origin) ? value : null;
  } catch {
    return null;
  }
};

async function zibal(path, payload) {
  const response = await fetch(`${apiBase()}/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ merchant: merchant(), ...payload }),
    ...(proxyAgent ? { dispatcher: proxyAgent } : {}),
  });
  return response.json().catch(() => ({}));
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

      const data = await zibal('request', {
        amount: amountRial(),
        callbackUrl,
        description: `Mr Judge - ${PACK_CREDITS} dispute analyses`,
        orderId: user.uid,
      });

      if (data.result !== 100 || !data.trackId) {
        console.error('zibal request failed:', data);
        return res.status(502).json({ error: 'ZIBAL_CREATE_FAILED', zibalCode: data.result });
      }

      await cmd('SET', `zb:${data.trackId}`, user.uid, 'EX', 86400);
      return res.status(200).json({
        trackId: data.trackId,
        payUrl: `https://gateway.zibal.ir/start/${data.trackId}`,
      });
    }

    if (action === 'verify') {
      // trackId is numeric; keep the regex as a single escaped digit class.
      if (!trackId || !/^\d{1,30}$/.test(String(trackId))) {
        return res.status(400).json({ error: 'Bad trackId' });
      }
      if ((await cmd('GET', `zb:${trackId}`)) !== user.uid) {
        return res.status(404).json({ error: 'UNKNOWN_PAYMENT' });
      }

      const paymentKey = `pay:zb:${trackId}`;
      if ((await cmd('SET', paymentKey, '1', 'NX')) !== 'OK') {
        return res.status(200).json({
          credits: Number(await cmd('GET', creditsKey(user.uid))) || 0,
          granted: false,
        });
      }

      try {
        const data = await zibal('verify', { trackId: Number(trackId) });
        if (![100, 201].includes(data.result) || (data.amount && Number(data.amount) !== amountRial())) {
          throw Object.assign(new Error('Payment not verified'), { code: 'NOT_PAID', zibalCode: data.result });
        }
        const credits = await grantPurchase(user.uid, PACK_CREDITS);
        return res.status(200).json({ credits, granted: true, refNumber: data.refNumber ?? null });
      } catch (error) {
        await cmd('DEL', paymentKey);
        if (error.code === 'NOT_PAID') {
          return res.status(402).json({ error: 'NOT_PAID', zibalCode: error.zibalCode });
        }
        throw error;
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('zibal error:', error);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
