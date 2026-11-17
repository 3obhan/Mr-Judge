/**
 * Payment by a payment LINK (for visitors in Iran), confirmed by hand. A payment link (any payment-page link) cannot tell
 * the app that it was paid, so: the visitor pays on the link's page, then sends the TRACKING CODE of the receipt here; you
 * check it in your payment panel and approve it on /admin.html; only then the credits are added.
 *
 *   visitor  { action: 'submit', reference }                      (Authorization: Bearer <account key>)
 *   you      { action: 'list' | 'approve' | 'reject', id }          (Authorization: Bearer <ADMIN_SECRET>)
 *
 * Vercel / Cloudflare env: ADMIN_SECRET (a long random text, at least 16 characters; nobody can use /admin without it).
 * MANUAL_PAY_URL (the payment link shown to visitors in Iran; the feature is OFF until you set it; see api/config.js).
 */
import { timingSafeEqual } from 'node:crypto';
import { cmd } from './_lib/redis.js';
import { guard, body, ipBucket, sha256, today, PACK_CREDITS } from './_lib/http.js';
import { authUser, grantPurchase } from './_lib/auth.js';

const MAX_SUBMITS_PER_DAY = 5;
const MAX_ADMIN_FAILS_PER_HOUR = 10;
const refKey = (reference) => sha256(String(reference).toLowerCase().replace(/\s+/g, ''));

function adminOk(req) {
  const secret = process.env.ADMIN_SECRET || '';
  const given = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1] || '';
  if (secret.length < 16 || !given) return false;
  const a = Buffer.from(sha256(secret)); const b = Buffer.from(sha256(given));
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const { action, reference, id } = body(req);

    // ---------- visitor ----------
    if (action === 'submit') {
      const user = await authUser(req);
      if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
      const ref = String(reference || '').trim();
      if (!/^[\p{L}\p{N}_ -]{4,40}$/u.test(ref)) return res.status(400).json({ error: 'BAD_REFERENCE' });

      const rl = `rl:mp:${user.uid}:${today()}`;
      const n = await cmd('INCR', rl);
      if (n === 1) await cmd('EXPIRE', rl, 172800);
      if (n > MAX_SUBMITS_PER_DAY) return res.status(429).json({ error: 'TOO_MANY' });

      if ((await cmd('SET', `pend:ref:${refKey(ref)}`, '1', 'NX')) !== 'OK') return res.status(409).json({ error: 'DUPLICATE' });
      const pid = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
      await cmd('SET', `pend:${pid}`, JSON.stringify({ uid: user.uid, ref, ts: Date.now() }));
      await cmd('SADD', 'pend:index', pid);
      return res.status(200).json({ ok: true });
    }

    // ---------- you (admin) ----------
    if (action === 'list' || action === 'approve' || action === 'reject') {
      if (String(process.env.ADMIN_SECRET || '').length < 16) return res.status(503).json({ error: 'ADMIN_NOT_CONFIGURED' });
      const bucket = `rl:adm:${ipBucket(req)}:${new Date().toISOString().slice(0, 13)}`;
      if (!adminOk(req)) {
        const fails = await cmd('INCR', bucket);
        if (fails === 1) await cmd('EXPIRE', bucket, 3700);
        return res.status(fails > MAX_ADMIN_FAILS_PER_HOUR ? 429 : 401).json({ error: 'BAD_ADMIN_SECRET' });
      }

      if (action === 'list') {
        const ids = (await cmd('SMEMBERS', 'pend:index')) || [];
        const items = [];
        for (const pid of ids) {
          const raw = await cmd('GET', `pend:${pid}`);
          if (!raw) { await cmd('SREM', 'pend:index', pid); continue; }
          const item = JSON.parse(raw);
          items.push({ id: pid, reference: item.ref, ts: item.ts, account: String(item.uid).slice(0, 8) });
        }
        items.sort((x, y) => y.ts - x.ts);
        return res.status(200).json({ items, packCredits: PACK_CREDITS });
      }

      const raw = typeof id === 'string' && /^[a-f0-9]{16}$/.test(id) ? await cmd('GET', `pend:${id}`) : null;
      if (!raw) return res.status(404).json({ error: 'UNKNOWN_REQUEST' });
      const item = JSON.parse(raw);

      if (action === 'reject') { // the visitor may send the right code again
        await cmd('DEL', `pend:${id}`); await cmd('SREM', 'pend:index', id); await cmd('DEL', `pend:ref:${refKey(item.ref)}`);
        return res.status(200).json({ ok: true });
      }
      // approve: each tracking code can be paid out once
      const first = await cmd('SET', `pay:link:${refKey(item.ref)}`, '1', 'NX');
      await cmd('DEL', `pend:${id}`); await cmd('SREM', 'pend:index', id);
      if (first !== 'OK') return res.status(200).json({ ok: true, already: true });
      try {
        const credits = await grantPurchase(item.uid, PACK_CREDITS);
        return res.status(200).json({ ok: true, credits });
      } catch (e) {
        await cmd('DEL', `pay:link:${refKey(item.ref)}`);
        await cmd('SET', `pend:${id}`, raw); await cmd('SADD', 'pend:index', id); // put it back
        throw e;
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('manualpay error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
