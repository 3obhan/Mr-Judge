/**
 * After paying, the payment page sends the buyer back to the site with a normal query string (before any "#"):
 *   Zibal     https://site/path?success=1&trackId=123456789
 *   PayPal    https://site/path?pp=1&token=<ORDER_ID>&PayerID=...
 *   Stripe    https://site/path?pay=stripe&session_id=cs_...
 */
import { splitLangPath, withLang } from '@/lib/langPath';

export const PAY_RETURN_KEY = 'judge_pay_return';
export const PAY_CANCELLED_KEY = 'judge_pay_cancelled';

export function captureReturnFromPayment() {
  try {
    const q = new URLSearchParams(window.location.search);
    let found = null;
    let cancelled = false;

    if (q.get('zb') === '1') {
      const a = q.get('Authority');
      if (q.get('Status') === 'OK' && /^[A-Za-z0-9]{10,64}$/.test(a || '')) {
        found = { provider: 'zibal', id: a };
      } else {
        cancelled = true;
      }
    } else if (q.get('success') != null && q.get('trackId')) {
      // زیبال: ?success=1&trackId=...
      const t = q.get('trackId');
      if (q.get('success') === '1' && /^\d{5,20}$/.test(t || '')) {
        found = { provider: 'zibal', id: t };
      } else {
        cancelled = true;
      }
    } else if (q.get('pp') === '1') {
      const t = q.get('token');
      if (/^[A-Za-z0-9_-]{5,64}$/.test(t || '')) {
        found = { provider: 'paypal', id: t };
      } else {
        cancelled = true;
      }
    } else if (q.get('pay') === 'stripe') {
      const s = q.get('session_id');
      if (/^cs_[A-Za-z0-9_]{10,200}$/.test(s || '')) {
        found = { provider: 'stripe', id: s };
      } else {
        cancelled = true;
      }
    } else {
      return;
    }

    if (found) sessionStorage.setItem(PAY_RETURN_KEY, JSON.stringify(found));
    if (cancelled) sessionStorage.setItem(PAY_CANCELLED_KEY, '1');
    const lang = splitLangPath(window.location.pathname).lang || 'en';
    window.history.replaceState({}, '', withLang(lang, '/Credits'));
  } catch {
    /* ignore */
  }
}