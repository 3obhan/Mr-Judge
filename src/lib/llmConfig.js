/**
 * Gemini configuration. The app talks to Gemini in one of three ways (checked in this order):
 *
 *  1. proxy  - VITE_GEMINI_PROXY_URL is set: calls  <that URL>/api/gemini  (e.g. your Vercel site).
 *              Use this for GitHub Pages / the Android app so the key stays on Vercel.
 *  2. direct - VITE_GEMINI_API_KEY is set: calls Google directly with that key. The key is baked into the
 *              public JavaScript (fine for local development; restrict the key if you deploy this way).
 *  3. server - nothing set: calls  /api/gemini  on the same site. This is what happens on Vercel, where the
 *              key lives in the server-side variable GEMINI_API_KEY (see api/gemini.js).
 */
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
export const GEMINI_PROXY_URL = (import.meta.env.VITE_GEMINI_PROXY_URL || '').replace(/\/$/, '');
export const GEMINI_MODE = GEMINI_PROXY_URL ? 'proxy' : GEMINI_API_KEY.length > 10 ? 'direct' : 'server';

/**
 * Models are tried in this order; if one is retired, renamed or not available to your key, the next one is used
 * automatically (and the working one is remembered). Google retires models every few months, so this list is
 * the only place to update. Override with VITE_GEMINI_MODEL="model-a,model-b" (comma separated).
 *
 * Note (Oct 2026): Google now limits the 2.5 models to accounts that already used them, so new API keys
 * must use the 3.x models. gemini-2.0-* is shut down.
 */
export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];

const parseModels = (value, fallback) => {
  const list = String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
};

/** Models for judging disputes. */
export const GEMINI_MODELS = parseModels(import.meta.env.VITE_GEMINI_MODEL, DEFAULT_MODELS);
/** Models for voice -> text (defaults to the same list). Override with VITE_GEMINI_STT_MODEL. */
export const GEMINI_STT_MODELS = parseModels(import.meta.env.VITE_GEMINI_STT_MODEL, GEMINI_MODELS);
