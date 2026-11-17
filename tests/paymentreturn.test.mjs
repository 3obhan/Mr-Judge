// Coming back from a payment page: which payment is remembered, and where the visitor lands.
import { register } from 'node:module';
import assert from 'node:assert/strict';
register('./loader.mjs', import.meta.url);
const store = new Map();
globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
let replaced = null;
const { captureReturnFromPayment, PAY_RETURN_KEY, PAY_CANCELLED_KEY } = await import(new URL('../src/lib/paymentReturn.js', import.meta.url));
const run = (search, pathname = '/fa/') => { store.clear(); replaced = null; globalThis.window = { location: { search, pathname }, history: { replaceState: (_s, _t, url) => { replaced = url; } } }; captureReturnFromPayment(); return { found: JSON.parse(store.get(PAY_RETURN_KEY) || 'null'), cancelled: store.has(PAY_CANCELLED_KEY) }; };

let r = run('?zb=1&success=1&status=2&trackId=3123456&orderId=abc'); assert.deepEqual(r.found, { provider: 'zibal', id: '3123456' }, 'Zibal'); assert.equal(replaced, '/fa/Credits', 'the visitor lands on the Credits page of the same language');
r = run('?zb=1&success=0&status=3&trackId=3123456'); assert.equal(r.found, null); assert.equal(r.cancelled, true, 'Zibal: not paid');
r = run('?zb=1&success=1&trackId=abc'); assert.equal(r.found, null); assert.equal(r.cancelled, true, 'Zibal: a track id that is not a number is not trusted');
r = run('?pp=1&token=ORDERID123&PayerID=X', '/de/'); assert.deepEqual(r.found, { provider: 'paypal', id: 'ORDERID123' }); assert.equal(replaced, '/de/Credits');
r = run('?pay=stripe&session_id=cs_test_abcdefghij1'); assert.deepEqual(r.found, { provider: 'stripe', id: 'cs_test_abcdefghij1' });
r = run('?pay=stripe&session_id=<script>'); assert.equal(r.found, null); assert.equal(r.cancelled, true);
r = run('?foo=bar'); assert.equal(r.found, null); assert.equal(r.cancelled, false); assert.equal(replaced, null, 'a normal visit is left alone');
r = run(''); assert.equal(replaced, null);
console.log('paymentreturn OK');
