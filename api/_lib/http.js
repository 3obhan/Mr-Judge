import { createHash } from 'node:crypto';
import { redisConfigured } from './redis.js';

const extraOrigins = () =>
  (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

/** Origins that may call the API: this site itself plus ALLOWED_ORIGINS (e.g. https://localhost for the Android app). */
export function originAllowed(req, origin) {
  const host = req.headers.host;
  return origin === `https://${host}` || origin === `http://${host}` || extraOrigins().includes(origin);
}

/**
 * Common checks for every endpoint. Returns true when the request has already been answered
 * (blocked origin, CORS preflight, wrong method, accounts not configured) and the handler must stop.
 */
export function guard(req, res, { needRedis = true, allowGet = false } = {}) {
  const origin = req.headers.origin;
  const sameOrigin = !origin || origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`;
  if (origin && !sameOrigin) {
    if (!extraOrigins().includes(origin)) { res.status(403).json({ error: 'Origin not allowed' }); return true; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  if (req.method !== 'POST' && !(allowGet && req.method === 'GET')) { res.status(405).json({ error: 'Method not allowed' }); return true; }
  if (needRedis && !redisConfigured()) { res.status(503).json({ error: 'ACCOUNTS_NOT_CONFIGURED' }); return true; }
  return false;
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

/** Anonymous per-IP bucket name (the IP itself is never stored). */
export const ipBucket = (req) =>
  sha256(String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown').slice(0, 16);

export const today = () => new Date().toISOString().slice(0, 10);

/** Pack size and price, in one place (the price text in the app is in src/lib/i18n.jsx: credits.offer / credits.price). */
export const PACK_CREDITS = Number(process.env.PACK_CREDITS || 5);
export const PACK_PRICE_TOMAN = Number(process.env.PACK_PRICE_TOMAN || 250000); // ZarinPal (Iran)
const usd = Number(process.env.PACK_PRICE_USD || 1);
export const PACK_PRICE_USD = (Number.isFinite(usd) && usd >= 0.5 ? usd : 1).toFixed(2); // Stripe and PayPal; always 2 decimals ("5" becomes "5.00")
/** Free analyses given when a NEW anonymous account is created (the first two are free). */
export const ANON_CREDITS = Number(process.env.ANON_CREDITS ?? 2);
/** Extra free analyses given once per verified email (0: email is only for signing in on other phones). */
export const FREE_CREDITS = Number(process.env.FREE_CREDITS ?? 0);
