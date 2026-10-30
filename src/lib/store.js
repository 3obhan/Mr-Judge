/**
 * Which distribution channel this build is for. Set by the mode of `vite build`:
 *   web    - the website: pays through the Shetab gateway (ZarinPal), see api/zarinpal.js
 *   bazaar - the Cafe Bazaar app: buying goes through Bazaar billing (Poolakey), verified on our server (api/bazaar.js)
 * See راهنما.md.
 */
export const STORE = (import.meta.env.VITE_STORE || 'web').toLowerCase();
export const IS_STORE_BUILD = STORE === 'bazaar';
export const EXTERNAL_PAYMENTS_ALLOWED = !IS_STORE_BUILD;

/** Cafe Bazaar in-app billing. The RSA key is the PUBLIC key from the Bazaar developer panel (safe to ship). */
export const BAZAAR_RSA_KEY = import.meta.env.VITE_BAZAAR_RSA_KEY || '';
export const BAZAAR_PRODUCT_ID = import.meta.env.VITE_BAZAAR_PRODUCT_ID || 'credits_5';
