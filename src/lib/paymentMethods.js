/**
 * Which payment methods a visitor is offered (the server only reports what is switched on):
 *   - Persian readers and visitors inside Iran: ONE Iranian method, in this order of preference: a hand-confirmed payment link
 *     ("link", only if you set one up), then Zibal ("zibal").
 *   - Everybody outside Iran, in every language: Stripe (cards, Apple Pay, Google Pay) and PayPal.
 *   - Visitors inside Iran do not get Stripe / PayPal (they cannot use them).
 * Pure function, tested in tests/paymentmethods.test.mjs.
 * @returns {string[]} ids in display order: 'link' | 'zibal' | 'stripe' | 'paypal'
 */
export function availableMethods(config, lang) {
  const m = config?.methods || {};
  const inIran = config?.country === 'IR';
  const persian = lang === 'fa' || inIran;
  const out = [];
  if (persian) {
    if (m.link && config?.linkUrl) out.push('link');
    else if (m.zibal) out.push('zibal');
  }
  if (!inIran) {
    if (m.stripe) out.push('stripe');
    if (m.paypal) out.push('paypal');
  }
  return out;
}
