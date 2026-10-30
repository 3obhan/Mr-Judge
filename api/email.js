/**
 * Email verification (one-time code). Closes the "reinstall for free credits" loophole: the free analyses are given
 * once per verified email, and the same email signs the user in on another phone.
 *   { action: 'request', email }        -> { ok: true }                 sends a 6-digit code (valid 10 minutes)
 *   { action: 'verify', email, code }   -> { credits, email, granted, accountKey? }
 *       - email not used yet:   linked to this account (and FREE_CREDITS added once, if that is set above 0)
 *       - email of this account: nothing changes
 *       - email of ANOTHER account: this phone signs in to that account (new accountKey returned) and any credits
 *         PAID FOR here are moved over (merged); free credits are not moved.
 *
 * Vercel env: EMAIL_HASH_SECRET (long random text), EMAIL_FROM (a sender address that is verified with your provider),
 *   and BREVO_API_KEY or RESEND_API_KEY. Optional app-review login: DEMO_EMAIL + DEMO_CODE (no email is sent).
 */
import { cmd } from './_lib/redis.js';
import { guard, body, ipBucket, sha256, FREE_CREDITS } from './_lib/http.js';
import { authUser, creditsKey, newAccountKey, formatKey, addDeviceKey, eraseAccount } from './_lib/auth.js';
import { emailConfigured, normalizeEmail, emailHash, maskEmail, sendCodeEmail } from './_lib/email.js';

const OTP_TTL = 600;
const MAX_ATTEMPTS = 5;
const hourBucket = () => new Date().toISOString().slice(0, 13);

async function limited(key, max, ttl) {
  const n = await cmd('INCR', key);
  if (n === 1) await cmd('EXPIRE', key, ttl);
  return n > max;
}

export default async function handler(req, res) {
  if (guard(req, res)) return;
  if (!emailConfigured()) return res.status(503).json({ error: 'EMAIL_NOT_CONFIGURED' });
  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });
    const { action, email, code } = body(req);
    const norm = normalizeEmail(email);
    if (!norm) return res.status(400).json({ error: 'BAD_EMAIL' });
    const h = emailHash(norm);
    const demo = process.env.DEMO_EMAIL && process.env.DEMO_CODE && normalizeEmail(process.env.DEMO_EMAIL) === norm;

    if (action === 'request') {
      const hour = hourBucket();
      if (await limited(`rl:em:${h}:${hour}`, 5, 3700) || await limited(`rl:emip:${ipBucket(req)}:${hour}`, 20, 3700)
        || await limited(`rl:emu:${user.uid}:${hour}`, 10, 3700)) {
        return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
      }
      const otp = demo ? String(process.env.DEMO_CODE) : String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
      await cmd('SET', `otp:${h}`, sha256(`${h}:${otp}`), 'EX', OTP_TTL);
      await cmd('DEL', `otpa:${h}`);
      if (!demo) {
        try { await sendCodeEmail(norm, otp); } catch (e) {
          console.error('email send failed:', e.message);
          await cmd('DEL', `otp:${h}`);
          return res.status(502).json({ error: 'EMAIL_SEND_FAILED' });
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'verify') {
      const stored = await cmd('GET', `otp:${h}`);
      if (!stored) return res.status(400).json({ error: 'CODE_EXPIRED' });
      const tries = Number(await cmd('INCR', `otpa:${h}`));
      if (tries === 1) await cmd('EXPIRE', `otpa:${h}`, OTP_TTL);
      if (tries > MAX_ATTEMPTS) { await cmd('DEL', `otp:${h}`); return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' }); }
      if (sha256(`${h}:${String(code || '').trim()}`) !== stored) return res.status(400).json({ error: 'WRONG_CODE' });
      await cmd('DEL', `otp:${h}`); await cmd('DEL', `otpa:${h}`);

      const mask = maskEmail(norm);
      const mine = await cmd('GET', `u:${user.uid}:email`);
      const owner = await cmd('GET', `e:${h}`);

      if (owner === user.uid) {
        return res.status(200).json({ credits: Number(await cmd('GET', creditsKey(user.uid))) || 0, email: mask, granted: 0 });
      }
      if (mine && mine !== h) return res.status(409).json({ error: 'ALREADY_HAS_EMAIL' }); // one email per account

      if (!owner) { // first time this email is verified: attach it to this account and give the free analyses once
        await cmd('SET', `e:${h}`, user.uid);
        await cmd('SET', `u:${user.uid}:email`, h);
        await cmd('SET', `u:${user.uid}:emailmask`, mask);
        let granted = 0;
        if ((await cmd('SET', `free:${h}`, '1', 'NX')) === 'OK') {
          await cmd('INCRBY', creditsKey(user.uid), FREE_CREDITS);
          granted = FREE_CREDITS;
        }
        return res.status(200).json({ credits: Number(await cmd('GET', creditsKey(user.uid))) || 0, email: mask, granted });
      }

      // The email already belongs to another account: sign this phone in to it and move over what was bought here
      // (only credits that were paid for move over: the free ones of a throw-away account are dropped)
      const have = Number(await cmd('GET', creditsKey(user.uid))) || 0;
      const paid = Number(await cmd('GET', `u:${user.uid}:bought`)) || 0;
      const bought = Math.min(have, paid);
      if (bought > 0) {
        await cmd('INCRBY', creditsKey(owner), bought);
        await cmd('INCRBY', `u:${owner}:bought`, bought);
      }
      await eraseAccount(user.uid);
      const key = newAccountKey();
      await addDeviceKey(owner, key);
      return res.status(200).json({
        accountKey: formatKey(key),
        credits: Number(await cmd('GET', creditsKey(owner))) || 0,
        email: (await cmd('GET', `u:${owner}:emailmask`)) || mask,
        granted: 0,
        merged: bought,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('email error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}
