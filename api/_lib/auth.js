import { cmd } from './redis.js';
import { sha256 } from './http.js';

// 32 symbols (no I, O, 0, 1) so the key is easy to read out and type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** New account key: 20 symbols = 100 bits, shown as XXXX-XXXX-XXXX-XXXX-XXXX. */
export function newAccountKey() {
  const b = crypto.getRandomValues(new Uint8Array(20));
  let s = '';
  for (let i = 0; i < 20; i += 1) s += ALPHABET[b[i] & 31];
  return s;
}

export const formatKey = (k) => k.match(/.{1,4}/g).join('-');
export const normalizeKey = (k) => String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const keyId = (normalized) => `k:${sha256(normalized)}`;
export const creditsKey = (uid) => `u:${uid}:credits`;

/** Gives an account one more device key (an account can have several: one per phone). */
export async function addDeviceKey(uid, key) {
  await cmd('SET', keyId(key), uid);
  await cmd('SADD', `u:${uid}:keys`, sha256(key));
}

/** Reads "Authorization: Bearer <key>". Returns { uid, key } or null. Only a hash of the key is stored. */
export async function authUser(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) return null;
  const key = normalizeKey(m[1]);
  if (key.length !== 20) return null;
  const uid = await cmd('GET', keyId(key));
  return uid ? { uid, key } : null;
}

/**
 * Removes an account completely: all its device keys, credits and the link to its email.
 * (The "free credits already given" marker for an email is kept on purpose, so deleting and re-creating an account
 * cannot be used to collect the free credits again. It is an HMAC hash, not the email address.)
 */
export async function eraseAccount(uid) {
  const hashes = (await cmd('SMEMBERS', `u:${uid}:keys`)) || [];
  for (const h of hashes) await cmd('DEL', `k:${h}`);
  const emailHash = await cmd('GET', `u:${uid}:email`);
  if (emailHash) await cmd('DEL', `e:${emailHash}`);
  for (const k of ['keys', 'credits', 'bought', 'created', 'email', 'emailmask']) await cmd('DEL', `u:${uid}:${k}`);
}

/** Adds credits that were PAID for. They are counted separately so that free credits cannot be moved between accounts. */
export async function grantPurchase(uid, n) {
  await cmd('INCRBY', `u:${uid}:bought`, n);
  return Number(await cmd('INCRBY', creditsKey(uid), n));
}
