// The whole site through the Cloudflare Worker entry: API handlers, built-in database (Durable Object logic),
// static-page fallback. Cloudflare's runtime is replaced by fakes; the app code is the real code.
import { register } from 'node:module';
import { createHmac, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
register('./loader.mjs', import.meta.url);

const { executeCommand } = await import(new URL('../cloudflare/redis-lite.js', import.meta.url));
const worker = (await import(new URL('../cloudflare/worker.js', import.meta.url))).default;
const { LANGUAGES } = await import(new URL('../src/locales/index.js', import.meta.url));

// fake Durable Object namespace: every command goes to the same storage, like the real "main" object
const map = new Map();
const storage = { get: async (k) => structuredClone(map.get(k)), put: async (k, v) => { map.set(k, structuredClone(v)); }, delete: async (k) => map.delete(k) };
const STORE = { idFromName: (n) => n, get: () => ({ cmd: (args) => executeCommand(storage, args) }) };
const assetCalls = [];
const ASSETS = { fetch: async (req) => { assetCalls.push(new URL(req.url).pathname); return new Response('<html>page</html>', { status: 200, headers: { 'content-type': 'text/html' } }); } };
const env = { STORE, ASSETS, GEMINI_API_KEY: 'gk', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_cf_test', ALLOWED_ORIGINS: 'https://localhost', PACK_PRICE_USD: '1.00' };

let geminiCalls = 0;
globalThis.fetch = async (url) => {
  if (String(url).includes('generativelanguage.googleapis.com')) { geminiCalls += 1; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 }); }
  return new Response('{}', { status: 404 });
};

const call = async (path, { method = 'POST', body, key, headers = {}, raw } = {}) => {
  const h = { 'content-type': 'application/json', host: 'site.test', 'cf-connecting-ip': '203.0.113.9', ...headers };
  if (key) h.authorization = `Bearer ${key}`;
  const res = await worker.fetch(new Request(`https://site.test${path}`, { method, headers: h, body: method === 'GET' ? undefined : (raw ?? JSON.stringify(body ?? {})) }), env);
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text, headers: res.headers };
};

// ---- the API through the Worker ----
let r = await call('/api/config', { method: 'GET', headers: { 'cf-ipcountry': 'de' } });
assert.equal(r.status, 200); assert.equal(r.json.methods.stripe, true, 'Worker variables reach the handlers (process.env)'); assert.equal(r.json.ready.redis, true, 'the built-in database counts as configured');
assert.equal(r.json.country, 'DE'); assert.equal(r.json.ready.email, false, 'no email settings -> the app hides email sign-in'); assert.equal(r.json.ready.gemini, true); assert.equal(r.json.stripeMode, 'test'); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('content-type'), /application\/json/);

r = await call('/api/account', { body: { action: 'create' } }); assert.equal(r.status, 200); const key = r.json.accountKey;
assert.match(key, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/); assert.equal(r.json.credits, 2, 'the first two analyses are free');
r = await call('/api/account', { body: { action: 'me' }, key }); assert.equal(r.json.credits, 2);
r = await call('/api/account', { body: { action: 'me' } }); assert.equal(r.status, 401);
r = await call('/api/credits', { body: { action: 'spend' }, key }); assert.equal(r.json.credits, 1); const ticket = r.json.ticket;
r = await call('/api/gemini', { body: { model: 'gemini-3.8-flash', body: { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }, ticket }, key }); assert.equal(r.status, 200); assert.equal(geminiCalls, 1);
r = await call('/api/credits', { body: { action: 'refund', ticket }, key }); assert.equal(r.status, 409, 'answered: no refund');
r = await call('/api/gemini', { body: { model: 'gemini-3.8-flash', body: { contents: [{}] } }, key }); assert.equal(r.status, 402, 'no ticket, no AI');
for (let i = 0; i < 2; i += 1) r = await call('/api/credits', { body: { action: 'spend' }, key });
assert.equal(r.status, 402); assert.equal(r.json.error, 'NO_CREDITS'); r = await call('/api/credits', { body: { action: 'balance' }, key }); assert.equal(r.json.credits, 0, 'never below zero');

// browsers: other sites are refused, the allowed origin gets CORS headers
r = await call('/api/account', { body: { action: 'me' }, key, headers: { origin: 'https://evil.test' } }); assert.equal(r.status, 403);
r = await call('/api/account', { body: { action: 'me' }, key, headers: { origin: 'https://localhost' } }); assert.equal(r.status, 200); assert.equal(r.headers.get('access-control-allow-origin'), 'https://localhost');
r = await call('/api/account', { method: 'OPTIONS', headers: { origin: 'https://localhost' } }); assert.equal(r.status, 204);
r = await call('/api/nope'); assert.equal(r.status, 404); r = await call('/api/constructor'); assert.equal(r.status, 404, 'only the listed endpoints exist');

// Stripe webhook: the signature is checked on the exact raw body, credits arrive once
const uid = map.get('k:' + createHash('sha256').update(key.replace(/-/g, '')).digest('hex')).v;
const session = { id: 'cs_test_cloudflare1', status: 'complete', payment_status: 'paid', currency: 'usd', amount_total: 100, metadata: { uid } };
const raw = JSON.stringify({ type: 'checkout.session.completed', data: { object: session } });
const t = Math.floor(Date.now() / 1000); const sig = `t=${t},v1=${createHmac('sha256', 'whsec_cf_test').update(`${t}.${raw}`).digest('hex')}`;
r = await call('/api/stripe-webhook', { raw, headers: { 'stripe-signature': sig } }); assert.equal(r.status, 200); assert.equal(r.json.granted, true);
r = await call('/api/stripe-webhook', { raw, headers: { 'stripe-signature': sig } }); assert.equal(r.json.granted, false, 'a retry gives nothing');
r = await call('/api/stripe-webhook', { raw: raw + ' ', headers: { 'stripe-signature': sig } }); assert.equal(r.status, 400, 'changed body');
r = await call('/api/credits', { body: { action: 'balance' }, key }); assert.equal(r.json.credits, 5, 'the pack was added once');
r = await call('/api/account', { body: { action: 'delete' }, key }); assert.equal(r.status, 200);
r = await call('/api/account', { body: { action: 'me' }, key }); assert.equal(r.status, 401);

// ---- pages ----
for (const [path, expected] of [['/de/Credits', '/de/'], ['/fa/History', '/fa/'], ['/ru/', '/ru/'], ['/Credits', '/'], ['/', '/'], ['/xx/Credits', '/']]) {
  assetCalls.length = 0; r = await call(path, { method: 'GET' }); assert.equal(r.status, 200, path); assert.deepEqual(assetCalls, [expected], `${path} is answered with ${expected}`);
}
r = await call('/assets/missing.js', { method: 'GET' }); assert.equal(r.status, 404, 'a missing file is a 404, not the app');
r = await call('/de/Credits', { method: 'POST' }); assert.equal(r.status, 405);
const wrangler = JSON.parse((await import('node:fs')).readFileSync(new URL('../cloudflare/wrangler.worker.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
assert.deepEqual(wrangler.compatibility_flags, ['nodejs_compat']); assert.equal(wrangler.durable_objects.bindings[0].name, 'STORE'); assert.deepEqual(wrangler.assets.run_worker_first, ['/api/*']);
assert.equal(wrangler.migrations[0].new_sqlite_classes[0], 'Store'); assert.equal(wrangler.main, 'worker.js'); assert.equal(wrangler.assets.directory, '../dist');
// the language list in the Worker matches the app's
const src = (await import('node:fs')).readFileSync(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
assert.equal(/LANG = \/\^\\\/\(([a-z|]+)\)/.exec(src)[1], LANGUAGES.map((l) => l.code).join('|'), 'Worker language list = locales');
console.log('cloudflare OK');
