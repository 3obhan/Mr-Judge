/**
 * Which payment methods a visitor is offered (the server only reports what is switched on):
 *   - Persian readers and visitors inside Iran: a configured manual payment link, otherwise Zibal.
 *   - Everybody outside Iran: Stripe and PayPal.
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
