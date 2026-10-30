/**
 * Cafe Bazaar purchase verification (same idea as api/play.js).
 *   { action: 'redeem', productId, purchaseToken } -> { credits, granted }
 *
 * The app sends the purchase token it got from Bazaar (Poolakey); this function asks Bazaar's developer API whether the
 * purchase is real and paid, and only then adds the credits. Each token works once.
 *
 * Vercel env: BAZAAR_CLIENT_ID, BAZAAR_CLIENT_SECRET, BAZAAR_REFRESH_TOKEN (see راهنما.md, section 3),
 *             BAZAAR_PACKAGE_NAME, optional BAZAAR_PRODUCT_ID (default credits_5).
 */
import { cmd } from './_lib/redis.js';
import { guard, body, sha256, PACK_CREDITS } from './_lib/http.js';
import { authUser, creditsKey, grantPurchase } from './_lib/auth.js';

const base = () => process.env.BAZAAR_API_BASE || 'https://pardakht.cafebazaar.ir';

async function accessToken() {
  const { BAZAAR_CLIENT_ID: id, BAZAAR_CLIENT_SECRET: secret, BAZAAR_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) throw Object.assign(new Error('Bazaar verification not configured'), { code: 'BAZAAR_NOT_CONFIGURED' });
  const r = await fetch(`${base()}/devapi/v2/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refresh }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Bazaar auth failed (${r.status})`);
  return j.access_token;
}

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
    const { action, productId, purchaseToken } = body(req);
    if (action !== 'redeem') return res.status(400).json({ error: 'Unknown action' });

    const allowedProduct = process.env.BAZAAR_PRODUCT_ID || 'credits_5';
    const pkg = process.env.BAZAAR_PACKAGE_NAME;
    if (!pkg) return res.status(503).json({ error: 'BAZAAR_NOT_CONFIGURED' });
    if (productId !== allowedProduct) return res.status(400).json({ error: 'Unknown product' });
    if (typeof purchaseToken !== 'string' || purchaseToken.length < 5 || purchaseToken.length > 500 || !/^[\w.\-=~]+$/.test(purchaseToken)) {
      return res.status(400).json({ error: 'Bad token' });
    }

    const flag = `pay:bazaar:${sha256(purchaseToken)}`;
    if ((await cmd('SET', flag, '1', 'NX')) !== 'OK') {
      return res.status(200).json({ credits: Number(await cmd('GET', creditsKey(user.uid))) || 0, granted: false });
    }
    try {
      const access = await accessToken();
      const r = await fetch(
        `${base()}/devapi/v2/api/validate/${encodeURIComponent(pkg)}/inapp/${encodeURIComponent(productId)}/purchases/${encodeURIComponent(purchaseToken)}/?access_token=${encodeURIComponent(access)}`
      );
      const purchase = await r.json().catch(() => ({}));
      if (!r.ok || purchase.purchaseState !== 0) throw Object.assign(new Error('Not paid'), { code: 'NOT_PAID' }); // 0 = purchased
      const credits = await grantPurchase(user.uid, PACK_CREDITS);
      return res.status(200).json({ credits, granted: true });
    } catch (e) {
      await cmd('DEL', flag); // allow a retry
      if (e.code === 'NOT_PAID') return res.status(402).json({ error: 'NOT_PAID' });
      throw e;
    }
  } catch (e) {
    console.error('bazaar error:', e);
    return res.status(e.code === 'BAZAAR_NOT_CONFIGURED' ? 503 : 500).json({ error: e.code || 'SERVER_ERROR' });
  }
}
