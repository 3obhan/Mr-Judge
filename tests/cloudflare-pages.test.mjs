// The site as Cloudflare PAGES runs it: functions/api/[[path]].js with the D1 database.
import { register } from 'node:module';
import { createHmac, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
let makeD1;
try { ({ makeD1 } = await import('./shim-d1.mjs')); } catch (e) { console.log('cloudflare-pages SKIPPED (no node:sqlite):', e.message); process.exit(0); }
register('./loader.mjs', import.meta.url);
const { onRequest } = await import(new URL('../functions/api/[[path]].js', import.meta.url));

const DB = makeD1();
const env = { DB, GEMINI_API_KEY: 'gk', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_pages', ADMIN_SECRET: 'admin-secret-1234567890', FALLBACK_API_KEY: 'fb' };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('generativelanguage.googleapis.com')) return new Response(JSON.stringify({ error: { message: 'Resource has been exhausted (e.g. check quota).' } }), { status: 429 });
  if (u.endsWith('/chat/completions')) return new Response(JSON.stringify({ choices: [{ message: { content: '{"from":"backup"}' } }] }), { status: 200 });
  return new Response('{}', { status: 404 });
};
const call = async (path, { method = 'POST', body, key, headers = {}, raw } = {}) => {
  const h = { 'content-type': 'application/json', host: 'site.pages.dev', 'cf-connecting-ip': '203.0.113.7', ...headers };
  if (key) h.authorization = `Bearer ${key}`;
  const res = await onRequest({ request: new Request(`https://site.pages.dev${path}`, { method, headers: h, body: method === 'GET' ? undefined : (raw ?? JSON.stringify(body ?? {})) }), env });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, headers: res.headers };
};

let r = await call('/api/config', { method: 'GET' }); assert.equal(r.status, 200); assert.equal(r.json.methods.stripe, true); assert.equal(r.json.ready.redis, true, 'the D1 database counts as the built-in database');
assert.equal(r.json.methods.link, true, 'ADMIN_SECRET switches the payment link on');
r = await call('/api/account', { body: { action: 'create' } }); const key = r.json.accountKey; assert.equal(r.json.credits, 2);
r = await call('/api/credits', { body: { action: 'spend' }, key }); assert.equal(r.json.credits, 1); const ticket = r.json.ticket;
r = await call('/api/gemini', { body: { model: 'gemini-3.8-flash', body: { contents: [{ role: 'user', parts: [{ text: 'judge' }] }] }, ticket }, key });
assert.equal(r.status, 200, 'Gemini out of quota -> the backup (Groq) answers'); assert.equal(r.json.candidates[0].content.parts[0].text, '{"from":"backup"}');
r = await call('/api/credits', { body: { action: 'refund', ticket }, key }); assert.equal(r.status, 409);
for (let i = 0; i < 2; i += 1) r = await call('/api/credits', { body: { action: 'spend' }, key }); assert.equal(r.status, 402);
r = await call('/api/credits', { body: { action: 'balance' }, key }); assert.equal(r.json.credits, 0);
// payment link: submit + approve
r = await call('/api/manualpay', { body: { action: 'submit', reference: 'TRK-998877' }, key }); assert.equal(r.status, 200);
const adm = { authorization: 'Bearer admin-secret-1234567890' };
r = await call('/api/manualpay', { body: { action: 'list' }, headers: adm }); assert.equal(r.json.items.length, 1);
r = await call('/api/manualpay', { body: { action: 'approve', id: r.json.items[0].id }, headers: adm }); assert.equal(r.json.credits, 5);
// Stripe webhook adds a pack once
const uid = (await DB.prepare('SELECT v FROM kv WHERE k = ?1').bind('k:' + createHash('sha256').update(key.replace(/-/g, '')).digest('hex')).first()).v;
const raw = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_pages0001', status: 'complete', payment_status: 'paid', currency: 'usd', amount_total: 100, metadata: { uid } } } });
const t = Math.floor(Date.now() / 1000); const sig = `t=${t},v1=${createHmac('sha256', 'whsec_pages').update(`${t}.${raw}`).digest('hex')}`;
r = await call('/api/stripe-webhook', { raw, headers: { 'stripe-signature': sig } }); assert.equal(r.json.granted, true);
r = await call('/api/stripe-webhook', { raw, headers: { 'stripe-signature': sig } }); assert.equal(r.json.granted, false);
r = await call('/api/credits', { body: { action: 'balance' }, key }); assert.equal(r.json.credits, 10);
r = await call('/api/account', { body: { action: 'delete' }, key }); assert.equal(r.status, 200); r = await call('/api/account', { body: { action: 'me' }, key }); assert.equal(r.status, 401);
r = await call('/api/nope'); assert.equal(r.status, 404);
console.log('cloudflare-pages OK');
