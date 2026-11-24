/**
 * Which payment methods a visitor is offered (the server only reports what is switched on):
 *   - Persian readers and visitors inside Iran: the Variza payment link ("link", confirmed by hand);
 *     ZarinPal ("zarinpal") only when the link is not set up.
 *   - Everybody outside Iran, in every language: Stripe (cards, Apple Pay, Google Pay) and PayPal.
 *   - Visitors inside Iran do not get Stripe / PayPal (they cannot use them).
 * Pure function, tested in tests/paymentmethods.test.mjs.
 * @returns {string[]} ids in display order: 'link' | 'zarinpal' | 'stripe' | 'paypal'
 */
export function availableMethods(config, lang) {
  const m = config?.methods || {};
  const inIran = config?.country === 'IR';
  const persian = lang === 'fa' || inIran;
  const out = [];
  if (persian) {
    if (m.link && config?.linkUrl) out.push('link');
    else if (m.zarinpal) out.push('zarinpal');
  }
  if (!inIran) {
    if (m.stripe) out.push('stripe');
    if (m.paypal) out.push('paypal');
  }
  return out;
}
