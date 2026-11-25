/**
 * Gemini Developer API configuration.
 * Stable production models, in preferred order:
 * - gemini-4-hydrogen: primary judging model (medium thinking).
 * - gemini-3.8-flash: general-purpose Flash fallback, and the first choice for voice -> text.
 * - gemini-3.5-flash-lite: lower-cost/lower-latency fallback.
 *
 * Override with VITE_GEMINI_MODEL="model-a,model-b" (comma separated).
 */
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
export const GEMINI_PROXY_URL = (import.meta.env.VITE_GEMINI_PROXY_URL || '').replace(/\/$/, '');
export const GEMINI_MODE = GEMINI_PROXY_URL ? 'proxy' : GEMINI_API_KEY.length > 10 ? 'direct' : 'server';

export const DEFAULT_MODELS = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];
export const DEFAULT_STT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

const parseModels = (value, fallback) => {
  const list = String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
};

/** Models for judging disputes. */
export const GEMINI_MODELS = parseModels(import.meta.env.VITE_GEMINI_MODEL, DEFAULT_MODELS);
/** Models for voice -> text. Override with VITE_GEMINI_STT_MODEL. */
export const GEMINI_STT_MODELS = parseModels(
  import.meta.env.VITE_GEMINI_STT_MODEL,
  import.meta.env.VITE_GEMINI_MODEL ? GEMINI_MODELS : DEFAULT_STT_MODELS
);
