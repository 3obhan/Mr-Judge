/**
 * ONE website serves browsers and the Android app: the app is a thin shell that opens the website (see capacitor.config.ts).
 * So there are no separate builds: whether we are inside the app is decided at run time.
 *   in a browser : web payment pages (Stripe, PayPal, Zibal ...), see src/lib/paymentMethods.js
 *   in the app   : the store's own billing (Cafe Bazaar / Poolakey), verified on our server (api/bazaar.js)
 */
export const isNativeApp = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
export const externalPaymentsAllowed = () => !isNativeApp();

/** Cafe Bazaar in-app billing. The RSA key is the PUBLIC key from the Bazaar developer panel (safe to ship); set at build time of the site. */
export const BAZAAR_RSA_KEY = import.meta.env.VITE_BAZAAR_RSA_KEY || '';
export const BAZAAR_PRODUCT_ID = import.meta.env.VITE_BAZAAR_PRODUCT_ID || 'credits_5';
