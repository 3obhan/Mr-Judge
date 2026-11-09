/**
 * Zibal payment gateway
 *   { action: 'create', callbackUrl } -> { trackId, payUrl }
 *   { action: 'verify', trackId }     -> { credits, granted, refNumber }
 *
 * Env: ZIBAL_MERCHANT  (کد مرچنت از پنل زیبال)
 * برای تست: ZIBAL_MERCHANT=zibal
 */
import { cmd } from './_lib/redis.js';
import { guard, body, originAllowed, PACK_CREDITS, PACK_PRICE_TOMAN } from './_lib/http.js';
import { authUser, creditsKey, grantPurchase } from './_lib/auth.js';

const merchant = () => process.env.ZIBAL_MERCHANT || '';
const AMOUNT_RIAL = () => PACK_PRICE_TOMAN * 10; // زیبال ریال می‌گیرد

const safeUrl = (req, u) => {
  try {
    const o = new URL(u).origin;
    return originAllowed(req, o) ? u : null;
  } catch {
    return null;
  }
};

const apiBase = () => process.env.ZIBAL_API_BASE || 'https://gateway.zibal.ir';

async function zibal(path, payload) {
  const r = await fetch(`${apiBase()}/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ merchant: merchant(), ...payload }),
  });
  return r.json().catch(() => ({}));
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
        amount: AMOUNT_RIAL(),
        callbackUrl,
        description: `آقای قاضی - ${PACK_CREDITS} تحلیل اختلاف`,
        orderId: user.uid, // اختیاری
      });

      if (data.result !== 100 || !data.trackId) {
        console.error('zibal request failed:', data);
        return res.status(502).json({ error: 'ZIBAL_CREATE_FAILED', zibalResult: data.result });
      }

      // پرداخت را به این کاربر bind کن
      await cmd('SET', `zb:${data.trackId}`, user.uid, 'EX', 86400);

      return res.status(200).json({
        trackId: data.trackId,
        payUrl: `https://gateway.zibal.ir/start/${data.trackId}`,
      });
    }

    if (action === 'verify') {
      if (!trackId) return res.status(400).json({ error: 'Bad trackId' });
      if ((await cmd('GET', `zb:${trackId}`)) !== user.uid) {
        return res.status(404).json({ error: 'UNKNOWN_PAYMENT' });
      }

      // هر پرداخت فقط یک بار اعتبار بدهد
      if ((await cmd('SET', `pay:zb:${trackId}`, '1', 'NX')) !== 'OK') {
        return res.status(200).json({
          credits: Number(await cmd('GET', creditsKey(user.uid))) || 0,
          granted: false,
        });
      }

      try {
        const data = await zibal('verify', { trackId: Number(trackId) });

        // 100 = موفق، 201 = قبلاً تأیید شده
        if (![100, 201].includes(data.result)) {
          throw Object.assign(new Error('Not paid'), { code: 'NOT_PAID', zibalResult: data.result });
        }

        const credits = await grantPurchase(user.uid, PACK_CREDITS);
        return res.status(200).json({
          credits,
          granted: true,
          refNumber: data.refNumber ?? null,
        });
      } catch (e) {
        await cmd('DEL', `pay:zb:${trackId}`); // اجازه retry
        if (e.code === 'NOT_PAID') {
          return res.status(402).json({ error: 'NOT_PAID', zibalResult: e.zibalResult });
        }
        throw e;
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('zibal error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}