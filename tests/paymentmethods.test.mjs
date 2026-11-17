// Who is offered which payment method.
import { register } from 'node:module';
import assert from 'node:assert/strict';
register('./loader.mjs', import.meta.url);
const { availableMethods } = await import(new URL('../src/lib/paymentMethods.js', import.meta.url));
const all = { methods: { stripe: true, paypal: true, zibal: true, link: false }, linkUrl: '', country: '' };

assert.deepEqual(availableMethods(all, 'en'), ['stripe', 'paypal'], 'foreigners: Stripe and PayPal');
assert.deepEqual(availableMethods(all, 'de'), ['stripe', 'paypal']);
assert.deepEqual(availableMethods(all, 'fa'), ['zibal', 'stripe', 'paypal'], 'Persian: Zibal first, card/PayPal still there for the diaspora');
assert.deepEqual(availableMethods({ ...all, country: 'IR' }, 'en'), ['zibal'], 'inside Iran, any language: only the Iranian method');
assert.deepEqual(availableMethods({ ...all, country: 'IR' }, 'fa'), ['zibal']);
assert.deepEqual(availableMethods({ ...all, country: 'DE' }, 'fa'), ['zibal', 'stripe', 'paypal'], 'Persian speaker abroad');
assert.deepEqual(availableMethods({ ...all, methods: { ...all.methods, zibal: false } }, 'fa'), ['stripe', 'paypal'], 'Zibal off');
assert.deepEqual(availableMethods({ ...all, methods: { ...all.methods, zibal: false }, country: 'IR' }, 'fa'), [], 'nothing to offer');
assert.deepEqual(availableMethods({ ...all, methods: { stripe: false, paypal: false, zibal: true } }, 'de'), [], 'Zibal is never shown to visitors outside Iran who read another language');
assert.deepEqual(availableMethods({ ...all, methods: { stripe: true } }, 'ru'), ['stripe']);
// the optional hand-confirmed payment link replaces Zibal when switched on (URL + ADMIN_SECRET on the server)
const withLink = { ...all, methods: { ...all.methods, link: true }, linkUrl: 'https://pay.example.test/x' };
assert.deepEqual(availableMethods(withLink, 'fa'), ['link', 'stripe', 'paypal']); assert.deepEqual(availableMethods({ ...withLink, country: 'IR' }, 'en'), ['link']);
assert.deepEqual(availableMethods({ ...withLink, linkUrl: '' }, 'fa'), ['zibal', 'stripe', 'paypal'], 'a link without an address is not offered');
assert.deepEqual(availableMethods({ ...withLink, methods: { ...withLink.methods, link: false } }, 'fa'), ['zibal', 'stripe', 'paypal']);
assert.deepEqual(availableMethods(null, 'en'), []); assert.deepEqual(availableMethods({}, 'fa'), []);
console.log('paymentmethods OK');
