// Who is offered which payment method.
import { register } from 'node:module';
import assert from 'node:assert/strict';
register('./loader.mjs', import.meta.url);
const { availableMethods } = await import(new URL('../src/lib/paymentMethods.js', import.meta.url));
const all = { methods: { stripe: true, paypal: true, zarinpal: true, link: true }, linkUrl: 'https://variza.ir/pay/x', country: '' };

assert.deepEqual(availableMethods(all, 'en'), ['stripe', 'paypal'], 'foreigners: Stripe and PayPal');
assert.deepEqual(availableMethods(all, 'de'), ['stripe', 'paypal']);
assert.deepEqual(availableMethods(all, 'fa'), ['link', 'stripe', 'paypal'], 'Persian: Variza first (instead of ZarinPal), card/PayPal still there for the diaspora');
assert.deepEqual(availableMethods({ ...all, country: 'IR' }, 'en'), ['link'], 'inside Iran, any language: only the Iranian method');
assert.deepEqual(availableMethods({ ...all, country: 'IR' }, 'fa'), ['link']);
assert.deepEqual(availableMethods({ ...all, country: 'DE' }, 'fa'), ['link', 'stripe', 'paypal'], 'Persian speaker abroad');
// the link is only offered when the server says it is on (ADMIN_SECRET) and has an address
assert.deepEqual(availableMethods({ ...all, methods: { ...all.methods, link: false } }, 'fa'), ['zarinpal', 'stripe', 'paypal'], 'link off -> ZarinPal is the fallback');
assert.deepEqual(availableMethods({ ...all, linkUrl: '' }, 'fa'), ['zarinpal', 'stripe', 'paypal']);
assert.deepEqual(availableMethods({ ...all, methods: { ...all.methods, link: false, zarinpal: false } }, 'fa'), ['stripe', 'paypal']);
assert.deepEqual(availableMethods({ ...all, methods: { ...all.methods, link: false, zarinpal: false }, country: 'IR' }, 'fa'), [], 'nothing to offer');
assert.deepEqual(availableMethods({ ...all, methods: { link: false, zarinpal: true } }, 'en'), [], 'ZarinPal is never shown to non-Persian visitors outside Iran');
assert.deepEqual(availableMethods({ ...all, methods: { stripe: true } }, 'ru'), ['stripe']);
assert.deepEqual(availableMethods(null, 'en'), []); assert.deepEqual(availableMethods({}, 'fa'), []);
console.log('paymentmethods OK');
