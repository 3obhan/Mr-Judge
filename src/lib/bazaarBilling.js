import { authedApi, setCachedCredits } from '@/lib/account';
import { STORE, BAZAAR_RSA_KEY, BAZAAR_PRODUCT_ID } from '@/lib/store';

/**
 * Cafe Bazaar billing (Poolakey) through the native Capacitor plugin in native/android/PoolakeyPlugin.kt.
 * Flow for one credit pack (consumable):
 *   connect -> purchase -> our server asks Bazaar if the purchase is real (api/bazaar.js) and adds the credits
 *   -> only then consume, so it can be bought again.
 * If the server cannot be reached, the purchase stays unconsumed and is finished the next time (restoreBazaarPurchases).
 */
const plugin = () => (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Poolakey : undefined);

/** True only inside the Bazaar Android build (the plugin does not exist in a browser). */
export const bazaarReady = () => STORE === 'bazaar' && !!plugin();

let onGranted = () => {};
export const setBazaarGrantedHandler = (fn) => { onGranted = fn; };

const ensureConnected = () => plugin().connect({ rsaKey: BAZAAR_RSA_KEY });

/** Server verifies + grants, then the purchase is consumed. Throws if the server could not verify it (nothing consumed). */
async function redeemAndConsume(purchase) {
  const purchaseToken = purchase?.purchaseToken;
  if (!purchaseToken) return;
  const r = await authedApi('bazaar', { action: 'redeem', productId: BAZAAR_PRODUCT_ID, purchaseToken });
  setCachedCredits(r.credits);
  try {
    await plugin().consume({ purchaseToken });
  } catch (e) {
    console.warn('Bazaar consume failed (credits are safe, will retry):', e); // the server never grants the same token twice
  }
  if (r.granted) onGranted();
}

/** Finish purchases that were paid but not yet completed (app closed mid-purchase, or the network failed). */
export async function restoreBazaarPurchases() {
  if (!bazaarReady()) return;
  await ensureConnected();
  const res = await plugin().getPurchased();
  for (const p of res?.purchases || []) {
    if (p.productId !== BAZAAR_PRODUCT_ID) continue;
    try { await redeemAndConsume(p); } catch (e) { console.warn('Bazaar purchase not verified yet:', e); }
  }
}

/**
 * Open the Bazaar purchase dialog.
 * @returns {Promise<boolean>} false if the user cancelled.
 * @throws error with .code 'BAZAAR_NOT_FOUND' (Bazaar not installed / signed in) or another failure code.
 */
export async function buyCreditsWithBazaar() {
  if (!bazaarReady()) { const e = new Error('Bazaar billing is not available'); e.code = 'BAZAAR_NOT_FOUND'; throw e; }
  await ensureConnected();
  // A pack that was paid but not finished would block a new purchase: finish it first
  try { await restoreBazaarPurchases(); } catch { /* ignore */ }
  try {
    const purchase = await plugin().purchase({ productId: BAZAAR_PRODUCT_ID, payload: String(Date.now()) });
    await redeemAndConsume(purchase);
    return true;
  } catch (e) {
    if (e?.code === 'CANCELED') return false;
    throw e;
  }
}
