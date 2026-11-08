/**
 * After paying, the payment page sends the buyer back to the site with a normal query string (before any "#"):
 *   Zibal     https://site/path?zp=1&Authority=A000...&Status=OK|NOK
 *   PayPal    https://site/path?pp=1&token=<ORDER_ID>&PayerID=...
 *   Stripe    https://site/path?pay=stripe&session_id=cs_...
 * (the address starts with the language: /de/?pay=stripe&session_id=…). This runs once at start-up: it remembers the payment, cleans the address bar and opens the Credits page, which then asks
 * the server to verify the payment with the provider (api/zibal.js, api/paypal.js, api/stripe.js).
 */
import { splitLangPath, withLang } from '@/lib/langPath';

export const PAY_RETURN_KEY = 'judge_pay_return';
export const PAY_CANCELLED_KEY = 'judge_pay_cancelled';

export function captureReturnFromPayment() {
  try {
    const q = new URLSearchParams(window.location.search);
    let found = null; let cancelled = false;
    if (q.get('zp') === '1') {
      const a = q.get('Authority');
      if (q.get('Status') === 'OK' && /^[A-Za-z0-9]{10,64}$/.test(a || '')) found = { provider: 'zibal', id: a }; else cancelled = true;
    } else if (q.get('pp') === '1') {
      const t = q.get('token');
      if (/^[A-Za-z0-9_-]{5,64}$/.test(t || '')) found = { provider: 'paypal', id: t }; else cancelled = true;
    } else if (q.get('pay') === 'stripe') {
      const s = q.get('session_id');
      if (/^cs_[A-Za-z0-9_]{10,200}$/.test(s || '')) found = { provider: 'stripe', id: s }; else cancelled = true;
    } else return;
    if (found) sessionStorage.setItem(PAY_RETURN_KEY, JSON.stringify(found));
    if (cancelled) sessionStorage.setItem(PAY_CANCELLED_KEY, '1');
    const lang = splitLangPath(window.location.pathname).lang || 'en';
    window.history.replaceState({}, '', withLang(lang, '/Credits'));
  } catch { /* ignore */ }
}
