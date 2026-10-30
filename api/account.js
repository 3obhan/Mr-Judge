/**
 * Accounts. A new install gets an anonymous account with a secret account key (shown in Settings).
 * Verifying an email (api/email.js) gives the free analyses once per email and lets the user sign in on another phone.
 *   { action: 'create' }  -> { accountKey, credits }
 *   { action: 'me' }      -> { credits, email, emailVerified }     (Authorization: Bearer <key>)
 *   { action: 'delete' }  -> { ok: true }   erases the account, its keys, credits and email link
 */
import { cmd } from './_lib/redis.js';
import { guard, body, ipBucket, today, ANON_CREDITS } from './_lib/http.js';
import { authUser, newAccountKey, formatKey, addDeviceKey, creditsKey, eraseAccount } from './_lib/auth.js';

const MAX_NEW_ACCOUNTS_PER_IP_PER_DAY = 20; // slows down mass-creation of accounts

export default async function handler(req, res) {
  if (guard(req, res)) return;
  try {
    const { action } = body(req);

    if (action === 'create') {
      const bucket = `rl:acct:${ipBucket(req)}:${today()}`;
      const n = await cmd('INCR', bucket);
      if (n === 1) await cmd('EXPIRE', bucket, 86400);
      if (n > MAX_NEW_ACCOUNTS_PER_IP_PER_DAY) return res.status(429).json({ error: 'TOO_MANY_ACCOUNTS' });

      const uid = crypto.randomUUID();
      const key = newAccountKey();
      await addDeviceKey(uid, key);
      await cmd('SET', creditsKey(uid), ANON_CREDITS);
      await cmd('SET', `u:${uid}:created`, new Date().toISOString());
      return res.status(200).json({ accountKey: formatKey(key), credits: ANON_CREDITS });
    }

    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });

    if (action === 'me') {
      const credits = Number(await cmd('GET', creditsKey(user.uid))) || 0;
      const mask = await cmd('GET', `u:${user.uid}:emailmask`);
      return res.status(200).json({ credits, email: mask || null, emailVerified: !!mask });
    }

    if (action === 'delete') {
      await eraseAccount(user.uid);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('account error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
