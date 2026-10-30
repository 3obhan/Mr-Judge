import { bazaarReady, setBazaarGrantedHandler, restoreBazaarPurchases, buyCreditsWithBazaar } from '@/lib/bazaarBilling';

/**
 * Store billing API used by the UI (Cafe Bazaar / Poolakey, see lib/bazaarBilling.js).
 * The server verifies every purchase with Bazaar before any credit is added.
 */
const listeners = new Set();
const emitGranted = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
setBazaarGrantedHandler(emitGranted);

/** Called whenever credits were added by a store purchase. Returns an unsubscribe function. */
export const subscribeGranted = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** True inside the Cafe Bazaar Android app. */
export const billingReady = () => bazaarReady();

/** @returns {Promise<boolean>} false = user cancelled. Credits arrive through subscribeGranted. */
export const buyCredits = () => buyCreditsWithBazaar();

/** Finish purchases that were paid but not yet completed. Safe to call often. */
export const restorePurchases = () => restoreBazaarPurchases();
