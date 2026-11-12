import { GEMINI_PROXY_URL } from '@/lib/llmConfig';

/**
 * Anonymous account + credits on the server.
 * The device keeps a secret account key (shown in Settings, can be typed on another device to restore the account).
 * Credits live on the server (api/credits.js), so they cannot be edited on the phone and follow the user to a new device.
 */
const KEY_STORAGE = 'judge_account_key_v1';
const CACHE_STORAGE = 'judge_credits_cache_v1';

/** Same site on Vercel, or the Vercel site from GitHub Pages / the Android app. */
export const API_BASE = GEMINI_PROXY_URL ? `${GEMINI_PROXY_URL}/api` : '/api';

export class ApiError extends Error {
  constructor(message, status, code, data) { super(message); this.status = status; this.code = code; this.data = data; }
}

export const getAccountKey = () => { try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; } };
const setAccountKey = (k) => { try { localStorage.setItem(KEY_STORAGE, k); } catch { /* ignore */ } };

/** Last balance we saw (shown instantly / offline). */
export const getCachedCredits = () => {
  try { const v = localStorage.getItem(CACHE_STORAGE); return v === null ? null : { remaining_credits: Number(v) || 0 }; } catch { return null; }
};
export const setCachedCredits = (n) => { try { localStorage.setItem(CACHE_STORAGE, String(n)); } catch { /* ignore */ } };

/** One POST to /api/<endpoint>. `key` overrides the stored account key ('' = no key). */
export async function api(endpoint, payload, { key } = {}) {
  const k = key === undefined ? getAccountKey() : key;
  let res;
  try {
    res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(k ? { Authorization: `Bearer ${k}` } : {}) },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError('Network error: could not reach the server.', 0, 'NETWORK');
  }
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(data.error || `HTTP ${res.status}`, res.status, data.error, data);
  return data;
}

let creating = null;
/** Makes sure this device has an account (creates one on first use). Returns the account key. */
export async function ensureAccount() {
  const existing = getAccountKey();
  if (existing) return existing;
  if (!creating) {
    creating = api('account', { action: 'create' }, { key: '' })
      .then((d) => { setAccountKey(d.accountKey); setCachedCredits(d.credits); return d.accountKey; })
      .finally(() => { creating = null; });
  }
  return creating;
}

/** Forgets the stored key and makes a fresh anonymous account (used when the server no longer knows our key, e.g. after a database change). */
export async function recreateAccount() {
  signOutLocal();
  return ensureAccount();
}

/** Authenticated call; if the server no longer knows our key, start a fresh account once and retry. */
export async function authedApi(endpoint, payload) {
  await ensureAccount();
  try {
    return await api(endpoint, payload);
  } catch (e) {
    if (e.status === 401 && e.code === 'INVALID_ACCOUNT') {
      signOutLocal();
      await ensureAccount();
      return api(endpoint, payload);
    }
    throw e;
  }
}

// ---------- account info + email ----------
const INFO_STORAGE = 'judge_account_info_v1';

/** Last known email status (shown instantly): { email: 'a***@gmail.com' | null, emailVerified: boolean } */
export const getCachedAccountInfo = () => {
  try { return JSON.parse(localStorage.getItem(INFO_STORAGE) || 'null') || { email: null, emailVerified: false }; }
  catch { return { email: null, emailVerified: false }; }
};
const setCachedAccountInfo = (info) => { try { localStorage.setItem(INFO_STORAGE, JSON.stringify(info)); } catch { /* ignore */ } };

/** Balance + email status from the server. @returns {Promise<{remaining_credits:number, email:string|null, emailVerified:boolean}>} */
export async function fetchAccountInfo() {
  const d = await authedApi('account', { action: 'me' });
  setCachedCredits(d.credits);
  setCachedAccountInfo({ email: d.email, emailVerified: !!d.emailVerified });
  return { remaining_credits: d.credits, email: d.email, emailVerified: !!d.emailVerified };
}

/** Sends a 6-digit code to the email address. */
export async function requestEmailCode(email) {
  await authedApi('email', { action: 'request', email });
}

/**
 * Checks the code. The first time an email is verified it gives the free analyses; an email that already has an
 * account signs this phone in to it (the server then returns a new account key).
 * @returns {Promise<{credits:number, email:string, granted:number, merged?:number}>}
 */
export async function verifyEmailCode(email, code) {
  const d = await authedApi('email', { action: 'verify', email, code });
  if (d.accountKey) setAccountKey(d.accountKey);
  setCachedCredits(d.credits);
  setCachedAccountInfo({ email: d.email, emailVerified: true });
  return d;
}

/** Forget this account on this phone (the account itself stays on the server; sign in again with the email). */
export function signOutLocal() {
  [KEY_STORAGE, CACHE_STORAGE, INFO_STORAGE].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
}

// ---------- credits ----------
/** @returns {Promise<{remaining_credits:number}>} */
export async function fetchCredits() {
  const d = await authedApi('credits', { action: 'balance' });
  setCachedCredits(d.credits);
  return { remaining_credits: d.credits };
}

/** Takes one credit. @returns {Promise<{ticket:string, credits:number}>} (throws ApiError code 'NO_CREDITS' when empty) */
export async function spendCredit() {
  const d = await authedApi('credits', { action: 'spend' });
  setCachedCredits(d.credits);
  return d;
}

/** Gives the credit back when the analysis failed. Never throws. @returns {Promise<number|null>} new balance */
export async function refundCredit(ticket) {
  try {
    const d = await authedApi('credits', { action: 'refund', ticket });
    setCachedCredits(d.credits);
    return d.credits;
  } catch { return null; }
}

// ---------- account management ----------
/** Use an account key typed by the user (e.g. from another device). Returns its balance. */
export async function restoreAccount(inputKey) {
  const d = await api('account', { action: 'me' }, { key: inputKey });
  setAccountKey(String(inputKey).toUpperCase().replace(/[^A-Z0-9]/g, '').match(/.{1,4}/g).join('-'));
  setCachedCredits(d.credits);
  setCachedAccountInfo({ email: d.email, emailVerified: !!d.emailVerified });
  return d.credits;
}

/** Erases the account and credits on the server. */
export async function deleteServerAccount() {
  if (!getAccountKey()) return;
  await api('account', { action: 'delete' });
}
