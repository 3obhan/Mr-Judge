// The real defaults of the Persian/Iran version: first 2 analyses free, 5 analyses = 250,000 toman.
import assert from 'node:assert/strict';
for (const k of ['ANON_CREDITS', 'FREE_CREDITS', 'PACK_CREDITS', 'PACK_PRICE_TOMAN', 'PACK_PRICE_USD']) delete process.env[k];
const h = await import(new URL('../api/_lib/http.js', import.meta.url));
assert.equal(h.ANON_CREDITS, 2); assert.equal(h.FREE_CREDITS, 0); assert.equal(h.PACK_CREDITS, 5); assert.equal(h.PACK_PRICE_TOMAN, 250000); assert.equal(h.PACK_PRICE_USD, '1.00');
process.env.PACK_PRICE_USD = '5'; const h2 = await import(new URL('../api/_lib/http.js?x=2', import.meta.url));
assert.equal(h2.PACK_PRICE_USD, '5.00', 'a whole number gets two decimals (PayPal and Stripe compare exact amounts)');
process.env.PACK_PRICE_USD = 'abc'; const h3 = await import(new URL('../api/_lib/http.js?x=3', import.meta.url)); assert.equal(h3.PACK_PRICE_USD, '1.00');
console.log('defaults OK');
