// End-to-end test of the API handlers with mock Upstash / Brevo / ZarinPal / Bazaar / Gemini servers.
// Run: npm run test:api
import http from 'node:http';
import { createHash, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';

// ---------- mocks ----------
const store = new Map();
const upstash = http.createServer((req, res) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
    if (req.headers.authorization !== 'Bearer tok') { res.statusCode = 401; return res.end('{"error":"unauthorized"}'); }
    const [c, ...a] = JSON.parse(d); let r = null;
    switch (c) {
      case 'GET': r = store.has(a[0]) ? store.get(a[0]) : null; break;
      case 'SET': { const nx = a.includes('NX'); if (nx && store.has(a[0])) { r = null; break; } store.set(a[0], a[1]); r = 'OK'; break; }
      case 'DEL': r = store.delete(a[0]) ? 1 : 0; break;
      case 'INCR': { const v = Number(store.get(a[0]) ?? 0) + 1; store.set(a[0], String(v)); r = v; break; }
      case 'DECR': { const v = Number(store.get(a[0]) ?? 0) - 1; store.set(a[0], String(v)); r = v; break; }
      case 'INCRBY': { const v = Number(store.get(a[0]) ?? 0) + Number(a[1]); store.set(a[0], String(v)); r = v; break; }
      case 'EXPIRE': r = 1; break;
      case 'SADD': { const s = store.get(a[0]) || new Set(); s.add(a[1]); store.set(a[0], s); r = 1; break; }
      case 'SMEMBERS': r = [...(store.get(a[0]) || [])]; break;
      default: res.statusCode = 400; return res.end(JSON.stringify({ error: 'unsupported ' + c }));
    }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ result: r }));
  });
});

const zpPayments = new Map(); let lastZarinpalHeaders = null; let lastZarinpalBody = ''; const paypalOrders = new Map(); const stripeSessions = new Map(); let lastStripeCreate = null;
const sent = []; let emailProviderDown = false; let geminiMode = 'ok'; let geminiCalls = 0; const groqCalls = [];
const ext = http.createServer((req, res) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
    const send = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
    const u = req.url; let m;
    if (u === '/v3/smtp/email') { // Brevo
      if (req.headers['api-key'] !== 'brevo-key') return send(401, {});
      if (emailProviderDown) return send(500, {});
      const m = JSON.parse(d); sent.push({ to: m.to[0].email, code: /code is (\d{6})/.exec(m.textContent)[1] }); return send(201, { messageId: 'x' });
    }
    if (u === '/v1/oauth2/token') return send(200, { access_token: 'pp-token' }); // PayPal
    if (u === '/v2/checkout/orders' && req.method === 'POST') {
      const o = JSON.parse(d); const id = 'ORDER' + (paypalOrders.size + 1) + 'ABCDE';
      paypalOrders.set(id, { paid: false, amount: o.purchase_units[0].amount.value });
      return send(201, { id, status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: 'https://paypal.test/pay/' + id }] });
    }
    m = /^\/v2\/checkout\/orders\/(\w+)\/capture$/.exec(u);
    if (m) { const o = paypalOrders.get(m[1]);
      if (!o || !o.paid) return send(422, { name: 'ORDER_NOT_APPROVED' });
      if (o.captured) return send(422, { name: 'ORDER_ALREADY_CAPTURED' });
      o.captured = true; return send(201, { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value: o.amount } }] } }] }); }
    m = /^\/v2\/checkout\/orders\/(\w+)$/.exec(u);
    if (m) { const o = paypalOrders.get(m[1]); if (!o) return send(404, {});
      return send(200, { status: o.captured ? 'COMPLETED' : 'APPROVED', purchase_units: [{ payments: { captures: o.captured ? [{ status: 'COMPLETED', amount: { currency_code: 'USD', value: o.amount } }] : [] } }] }); }
    if (u === '/v1/checkout/sessions' && req.method === 'POST') { // Stripe
      if (req.headers.authorization !== 'Bearer sk_test_x') return send(401, { error: { message: 'bad key' } });
      const f = new URLSearchParams(d); const id = 'cs_test_' + String(stripeSessions.size + 1).padStart(12, 'a');
      lastStripeCreate = Object.fromEntries(f.entries());
      stripeSessions.set(id, { id, status: 'open', payment_status: 'unpaid', currency: f.get('line_items[0][price_data][currency]'), amount_total: Number(f.get('line_items[0][price_data][unit_amount]')), metadata: { uid: f.get('metadata[uid]') } });
      return send(200, { id, url: 'https://checkout.stripe.test/c/' + id });
    }
    m = /^\/v1\/checkout\/sessions\/(cs_\w+)$/.exec(u);
    if (m) { if (req.headers.authorization !== 'Bearer sk_test_x') return send(401, {}); const x = stripeSessions.get(m[1]); return x ? send(200, x) : send(404, { error: { message: 'No such session' } }); }
    if (u === '/pg/v4/payment/request.json') { // ZarinPal
      lastZarinpalHeaders = req.headers; lastZarinpalBody = d;
      const o = JSON.parse(d);
      if (o.merchant_id !== 'zp-merchant-0000-0000-0000-000000000000' || o.amount !== 2500000 || !o.callback_url) return send(200, { data: [], errors: { code: -9 } });
      const id = 'A' + String(zpPayments.size + 1).padStart(35, '0'); zpPayments.set(id, { paid: false, verified: false });
      return send(200, { data: { code: 100, message: 'Success', authority: id, fee_type: 'Merchant', fee: 0 }, errors: [] });
    }
    if (u === '/pg/v4/payment/verify.json') {
      const o = JSON.parse(d); const p = zpPayments.get(o.authority);
      if (!p || !p.paid || o.amount !== 2500000 || o.merchant_id !== 'zp-merchant-0000-0000-0000-000000000000') return send(200, { data: [], errors: { code: -53 } });
      const code = p.verified ? 101 : 100; p.verified = true;
      return send(200, { data: { code, message: 'Verified', ref_id: 12345, card_pan: '621986******4212' }, errors: [] });
    }
    if (u === '/devapi/v2/auth/token/') { // Bazaar
      const p = new URLSearchParams(d);
      return p.get('grant_type') === 'refresh_token' && p.get('refresh_token') === 'rt' && p.get('client_id') === 'cid' && p.get('client_secret') === 'csec'
        ? send(200, { access_token: 'b-token', expires_in: 3600 }) : send(400, { error: 'invalid_grant' });
    }
    m = /^\/devapi\/v2\/api\/validate\/([^/]+)\/inapp\/([^/]+)\/purchases\/([^/?]+)\/\?access_token=(.+)$/.exec(u);
    if (m) { if (m[4] !== 'b-token' || m[1] !== 'com.test.judge') return send(401, {});
      const t = decodeURIComponent(m[3]); return t.startsWith('BPAID') ? send(200, { purchaseState: 0, consumptionState: 0 }) : t.startsWith('BREFUND') ? send(200, { purchaseState: 1 }) : send(404, { error: 'not_found' }); }
    if (u.startsWith('/v1beta/models/')) {
      geminiCalls += 1;
      if (geminiMode === '429') return send(429, { error: { message: 'Resource has been exhausted (e.g. check quota).' } });
      if (geminiMode === 'badrequest') return send(400, { error: { message: 'Invalid JSON payload received.' } });
      if (geminiMode === 'location') return send(400, { error: { message: 'User location is not supported for the API use.' } });
      return send(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    }
    if (u === '/openai/v1/chat/completions') { // Groq-style backup
      groqCalls.push({ auth: req.headers.authorization, json: JSON.parse(d) });
      return send(200, { choices: [{ message: { role: 'assistant', content: '{"from":"backup"}' } }] });
    }
    if (u === '/openai/v1/audio/transcriptions') {
      groqCalls.push({ auth: req.headers.authorization, raw: d });
      return send(200, { text: ' سلام دنیا ' });
    }
    send(404, { error: 'mock 404 ' + u });
  });
});
await new Promise((r) => upstash.listen(0, r)); await new Promise((r) => ext.listen(0, r));
const EXT = `http://127.0.0.1:${ext.address().port}`;
Object.assign(process.env, {
  UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${upstash.address().port}`, UPSTASH_REDIS_REST_TOKEN: 'tok',
  PAYPAL_CLIENT_ID: 'cid', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_API_BASE: EXT,
  STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_API_BASE: EXT, STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  ZARINPAL_MERCHANT_ID: 'zp-merchant-0000-0000-0000-000000000000', ZARINPAL_API_BASE: EXT, ZARINPAL_PAY_BASE: 'https://pay.test',
  BAZAAR_API_BASE: EXT, BAZAAR_CLIENT_ID: 'cid', BAZAAR_CLIENT_SECRET: 'csec', BAZAAR_REFRESH_TOKEN: 'rt', BAZAAR_PACKAGE_NAME: 'com.test.judge',
  ANON_CREDITS: '0', FREE_CREDITS: '2', // the test checks the email/free-credit mechanism; the real defaults are checked in defaults.test.mjs
  FALLBACK_API_KEY: 'fb-key', FALLBACK_BASE_URL: `${EXT}/openai/v1`, FALLBACK_STT: '1',
  GEMINI_API_KEY: 'gk', GEMINI_API_BASE: EXT, ALLOWED_ORIGINS: 'https://localhost',
  EMAIL_HASH_SECRET: 'test-secret-1234567890', BREVO_API_KEY: 'brevo-key', BREVO_API_BASE: EXT, EMAIL_FROM: 'noreply@test.dev',
  DEMO_EMAIL: 'reviewer@demo.test', DEMO_CODE: '424242',
});

const mods = {};
for (const n of ['account', 'credits', 'zarinpal', 'bazaar', 'email', 'gemini', 'paypal', 'stripe', 'stripe-webhook', 'config']) mods[n] = (await import(new URL(`../api/${n}.js`, import.meta.url))).default;

async function call(name, payload, { key, origin, method = 'POST', ip = '1.1.1.1', raw, headers = {} } = {}) {
  const req = { method, headers: { host: 'site.test', origin, authorization: key ? `Bearer ${key}` : undefined, 'x-forwarded-for': ip, ...headers }, body: payload };
  if (raw !== undefined) { req.rawBody = raw; req.body = undefined; }
  const out = { status: 200, headers: {} };
  const res = { status(c) { out.status = c; return this; }, json(o) { out.body = o; return this; }, send(t) { out.body = JSON.parse(t); return this; }, end() { return this; }, setHeader(k, v) { out.headers[k] = v; } };
  await mods[name](req, res); return out;
}
let ipN = 10;
const anon = async () => (await call('account', { action: 'create' }, { ip: `10.0.0.${ipN++}` })).body.accountKey;
async function verifyEmail(key, email) {
  let r = await call('email', { action: 'request', email }, { key }); assert.equal(r.status, 200, 'request ' + JSON.stringify(r.body));
  const code = sent.filter((s) => s.to === email.toLowerCase().replace(/\+.*@/, '@')).pop()?.code ?? sent[sent.length - 1].code;
  return call('email', { action: 'verify', email, code }, { key });
}
const credits = async (key) => (await call('credits', { action: 'balance' }, { key })).body.credits;

// ---------- accounts ----------
let r = await call('account', { action: 'create' });
assert.equal(r.status, 200); const k0 = r.body.accountKey;
assert.match(k0, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/); assert.equal(r.body.credits, 0, 'anonymous accounts start with no free credits');
assert.ok(![...store.keys()].some((k) => k.includes(k0.replace(/-/g, ''))), 'raw key must not be stored');
r = await call('account', { action: 'me' }, { key: k0 }); assert.equal(r.body.credits, 0); assert.equal(r.body.emailVerified, false);
r = await call('account', { action: 'me' }, { key: k0.toLowerCase().replace(/-/g, ' ') }); assert.equal(r.status, 200, 'key typed in lowercase/with spaces works');
r = await call('account', { action: 'me' }, { key: 'AAAA-AAAA-AAAA-AAAA-AAAA' }); assert.equal(r.status, 401);
r = await call('account', { action: 'me' }); assert.equal(r.status, 401);
r = await call('account', { action: 'me' }, { key: k0, origin: 'https://evil.test' }); assert.equal(r.status, 403);
r = await call('account', { action: 'me' }, { key: k0, origin: 'https://localhost' }); assert.equal(r.status, 200); assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://localhost');
r = await call('account', {}, { method: 'GET' }); assert.equal(r.status, 405);
console.log('ok account');

// ---------- email ----------
r = await call('email', { action: 'request', email: 'not-an-email' }, { key: k0 }); assert.equal(r.status, 400);
r = await call('email', { action: 'request', email: 'a@b.test' }); assert.equal(r.status, 401);
r = await call('email', { action: 'verify', email: 'ali@x.test', code: '123456' }, { key: k0 }); assert.equal(r.body.error, 'CODE_EXPIRED');
await call('email', { action: 'request', email: 'ali@x.test' }, { key: k0 });
r = await call('email', { action: 'verify', email: 'ali@x.test', code: '000000' }, { key: k0 }); assert.equal(r.body.error, 'WRONG_CODE');
for (let i = 0; i < 4; i += 1) r = await call('email', { action: 'verify', email: 'ali@x.test', code: '000000' }, { key: k0 });
r = await call('email', { action: 'verify', email: 'ali@x.test', code: '000000' }, { key: k0 }); assert.equal(r.status, 429, 'code locked after 5 wrong tries');
assert.ok(![...store.keys()].some((k) => k.includes('ali@x.test')), 'email address must not be stored');

const u1 = await anon();
r = await verifyEmail(u1, 'Ali.Test+promo@gmail.com'); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.granted, 2); assert.equal(r.body.credits, 2); assert.match(r.body.email, /^a\*\*\*@gmail\.com$/);
assert.ok(![...store.keys()].some((k) => k.toLowerCase().includes('alitest')), 'no plain email in the database');
r = await call('account', { action: 'me' }, { key: u1 }); assert.equal(r.body.emailVerified, true);
r = await verifyEmail(u1, 'alitest@gmail.com'); assert.equal(r.body.granted, 0, 'same account, same email: nothing new');
// same mailbox written differently from a new phone: signs in to the SAME account (no second free credit)
const u2 = await anon();
r = await call('email', { action: 'request', email: 'ALI.TEST@googlemail.com' }, { key: u2 });
r = await call('email', { action: 'verify', email: 'ALI.TEST@googlemail.com', code: sent.at(-1).code }, { key: u2 });
assert.equal(r.status, 200); assert.equal(r.body.granted, 0); assert.equal(r.body.credits, 2); assert.ok(r.body.accountKey, 'new key for this phone');
const u2b = r.body.accountKey;
assert.equal((await call('account', { action: 'me' }, { key: u2 })).status, 401, 'the temporary anonymous account is gone');
assert.equal(await credits(u2b), 2); assert.equal(await credits(u1), 2, 'both phones share one balance');
// one email per account
r = await verifyEmail(u1, 'other@x.test'); assert.equal(r.status, 409);
// credits bought on an anonymous phone are moved into the account when the user signs in
const u3 = await anon();
const uid3 = store.get('k:' + createHash('sha256').update(u3.replace(/-/g, '')).digest('hex'));
store.set(`u:${uid3}:credits`, '7'); store.set(`u:${uid3}:bought`, '5'); // 5 bought + 2 free on a throw-away phone
r = await call('email', { action: 'request', email: 'ali.test@gmail.com' }, { key: u3 });
r = await call('email', { action: 'verify', email: 'ali.test@gmail.com', code: sent.at(-1).code }, { key: u3 });
assert.equal(r.body.merged, 5, 'only the paid credits move'); assert.equal(await credits(r.body.accountKey), 7, 'account had 2 + 5 paid; the throw-away 2 free are dropped');
// demo login for app review (no email sent)
const before = sent.length; const u4 = await anon();
r = await call('email', { action: 'request', email: 'reviewer@demo.test' }, { key: u4 }); assert.equal(r.status, 200); assert.equal(sent.length, before, 'no email for the demo address');
r = await call('email', { action: 'verify', email: 'reviewer@demo.test', code: '424242' }, { key: u4 }); assert.equal(r.status, 200); assert.equal(r.body.credits, 2);
// provider down
emailProviderDown = true; const u5 = await anon(); r = await call('email', { action: 'request', email: 'down@x.test' }, { key: u5 }); assert.equal(r.status, 502); emailProviderDown = false;
// per-email hourly limit
const u6 = await anon(); let last;
for (let i = 0; i < 6; i += 1) last = await call('email', { action: 'request', email: 'spam@x.test' }, { key: u6 }); assert.equal(last.status, 429);
// deleting the account does not allow collecting the free credits again with the same email
const uA = await anon(); r = await verifyEmail(uA, 'once@x.test'); assert.equal(r.body.granted, 2);
assert.equal((await call('account', { action: 'delete' }, { key: uA })).status, 200);
const uB = await anon(); r = await verifyEmail(uB, 'once@x.test'); assert.equal(r.status, 200); assert.equal(r.body.granted, 0, 'no second free credits after delete + re-create'); assert.equal(r.body.credits, 0);
console.log('ok email');

// ---------- spend / gemini / refund ----------
const key = await anon(); r = await verifyEmail(key, 'spender@x.test'); assert.equal(r.body.credits, 2); // fresh account with the 2 free credits
r = await call('credits', { action: 'spend' }, { key }); assert.equal(r.status, 200); assert.equal(r.body.credits, 1); const t1 = r.body.ticket;
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [] }, kind: 'judge' }, { key }); assert.equal(r.status, 402);
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [] }, ticket: 'a'.repeat(32) }, { key }); assert.equal(r.status, 402);
r = await call('gemini', { model: 'evil-model', body: { contents: [] }, ticket: t1 }, { key }); assert.equal(r.status, 400);
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [{}] }, ticket: t1 }, { key }); assert.equal(r.status, 200);
r = await call('credits', { action: 'refund', ticket: t1 }, { key }); assert.equal(r.status, 409);
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [{}] }, ticket: t1 }, { key }); assert.equal(r.status, 200);
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [{}] }, ticket: t1 }, { key }); assert.equal(r.status, 409);
r = await call('credits', { action: 'spend' }, { key }); assert.equal(r.body.credits, 0); const t2 = r.body.ticket;
r = await call('credits', { action: 'spend' }, { key }); assert.equal(r.status, 402); assert.equal(r.body.error, 'NO_CREDITS');
assert.equal(await credits(key), 0);
r = await call('credits', { action: 'refund', ticket: t2 }, { key }); assert.equal(r.body.credits, 1);
r = await call('credits', { action: 'refund', ticket: t2 }, { key }); assert.equal(r.status, 404);
const t3 = (await call('credits', { action: 'spend' }, { key })).body.ticket;
const other = await anon();
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [{}] }, ticket: t3 }, { key: other }); assert.equal(r.status, 402);
r = await call('credits', { action: 'refund', ticket: t3 }, { key: other }); assert.equal(r.status, 404);
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [{}] }, kind: 'stt' }, { key }); assert.equal(r.status, 200);
r = await call('gemini', { model: 'gemini-3.8-flash', body: { contents: [{}] }, kind: 'stt' }); assert.equal(r.status, 401);
console.log('ok credits+gemini');

// ---------- backup AI (Groq / Grok) ----------
const fbKey = await anon(); await verifyEmail(fbKey, 'backup@x.test');
const gem = (extra = {}) => ({ model: 'gemini-3.8-flash', body: { contents: [{ role: 'user', parts: [{ text: 'judge this' }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { from: { type: 'STRING', description: 'who answered' } } } } }, ...extra });
let tk = (await call('credits', { action: 'spend' }, { key: fbKey })).body.ticket;
geminiMode = '429'; groqCalls.length = 0;
r = await call('gemini', gem({ ticket: tk }), { key: fbKey });
assert.equal(r.status, 200, 'Gemini out of quota -> the backup answers'); assert.equal(r.body.candidates[0].content.parts[0].text, '{"from":"backup"}', 'answer comes back in Gemini format');
assert.equal(groqCalls[0].auth, 'Bearer fb-key'); assert.equal(groqCalls[0].json.model, 'llama-3.3-70b-versatile'); assert.deepEqual(groqCalls[0].json.response_format, { type: 'json_object' });
assert.match(groqCalls[0].json.messages[0].content, /judge this[\s\S]*"from" \(string\): who answered/, 'the JSON fields are described to the backup model');
assert.equal((await call('credits', { action: 'refund', ticket: tk }, { key: fbKey })).status, 409, 'an answer from the backup also spends the credit');
tk = (await call('credits', { action: 'spend' }, { key: fbKey })).body.ticket;
geminiMode = 'badrequest'; groqCalls.length = 0; r = await call('gemini', gem({ ticket: tk }), { key: fbKey });
assert.equal(r.status, 400, 'a plain bad request is not sent to the backup'); assert.equal(groqCalls.length, 0);
geminiMode = 'location'; r = await call('gemini', gem({ ticket: tk }), { key: fbKey }); assert.equal(r.status, 200, 'region block -> backup'); assert.equal(groqCalls.length, 1);
geminiMode = 'ok'; process.env.AI_PRIMARY = 'fallback'; geminiCalls = 0;
r = await call('gemini', gem({ ticket: tk }), { key: fbKey }); assert.equal(r.status, 200); assert.equal(geminiCalls, 0, 'AI_PRIMARY=fallback never calls Gemini');
r = await call('gemini', gem({ ticket: tk }), { key: fbKey }); assert.equal(r.status, 409, 'the ticket allows two answers only (the region one + this one)');
delete process.env.AI_PRIMARY;
// voice -> text
groqCalls.length = 0; geminiMode = '429';
r = await call('gemini', { model: 'gemini-3.8-flash', kind: 'stt', body: { contents: [{ role: 'user', parts: [{ text: 'Language code: fa.\nYou are a professional Persian (Farsi) speech-to-text engine.' }, { inlineData: { mimeType: 'audio/wav', data: Buffer.from('RIFFxxxxWAVE').toString('base64') } }] }] } }, { key: fbKey });
assert.equal(r.status, 200); assert.deepEqual(JSON.parse(r.body.candidates[0].content.parts[0].text), { transcript: 'سلام دنیا' }, 'voice goes to Whisper, the transcript is trimmed');
assert.match(groqCalls[0].raw, /whisper-large-v3-turbo/); assert.match(groqCalls[0].raw, /name="language"\r\n\r\nfa/); assert.match(groqCalls[0].raw, /filename="audio\.wav"/);
// without a backup key everything stays as before
const fb2 = await anon(); await verifyEmail(fb2, 'backup2@x.test');
const savedFb = process.env.FALLBACK_API_KEY; delete process.env.FALLBACK_API_KEY; groqCalls.length = 0;
tk = (await call('credits', { action: 'spend' }, { key: fb2 })).body.ticket;
r = await call('gemini', gem({ ticket: tk }), { key: fb2 }); assert.equal(r.status, 429, "no backup configured: Gemini's error is passed on"); assert.equal(groqCalls.length, 0);
assert.equal((await call('credits', { action: 'refund', ticket: tk }, { key: fb2 })).status, 200, 'and the credit is refunded because nothing answered');
process.env.FALLBACK_API_KEY = savedFb; geminiMode = 'ok';
console.log('ok backup AI');

for (let i = 0; i < 25; i += 1) r = await call('account', { action: 'create' }, { ip: '9.9.9.9' });
assert.equal(r.status, 429); console.log('ok rate limit');

// ---------- ZarinPal (Shetab gateway) ----------
r = await call('zarinpal', { action: 'create', callbackUrl: 'https://evil.test/x' }, { key }); assert.equal(r.status, 400, 'open redirect blocked');
process.env.ZARINPAL_MERCHANT_ID = 'wrong-merchant';
r = await call('zarinpal', { action: 'create', callbackUrl: 'https://site.test/?zp=1' }, { key }); assert.equal(r.status, 502); assert.equal(r.body.zarinpalCode, -9, 'the gateway error code is passed on');
process.env.ZARINPAL_MERCHANT_ID = 'zp-merchant-0000-0000-0000-000000000000';
r = await call('zarinpal', { action: 'create', callbackUrl: 'https://site.test/?zp=1' }, { key }); assert.equal(r.status, 200); const au = r.body.authority; assert.equal(r.body.payUrl, 'https://pay.test/pg/StartPay/' + au);
r = await call('zarinpal', { action: 'verify', authority: au }, { key: other }); assert.equal(r.status, 404, "other account can't redeem my payment");
const b0 = await credits(key);
r = await call('zarinpal', { action: 'verify', authority: au }, { key }); assert.equal(r.status, 402, 'unpaid -> no credits'); assert.equal(r.body.zarinpalCode, -53); assert.equal(await credits(key), b0);
zpPayments.get(au).paid = true;
r = await call('zarinpal', { action: 'verify', authority: au }, { key }); assert.equal(r.status, 200); assert.equal(r.body.granted, true); assert.equal(r.body.credits, b0 + 5);
r = await call('zarinpal', { action: 'verify', authority: au }, { key }); assert.equal(r.body.granted, false); assert.equal(r.body.credits, b0 + 5, 'second verify gives nothing');
assert.equal(Number(store.get([...store.keys()].find((k) => k.endsWith(':bought')) )) >= 0, true);
// a retry after a crash: gateway already says 101, flag was cleared, credits still granted only once
const au2 = (await call('zarinpal', { action: 'create', callbackUrl: 'https://site.test/' }, { key })).body.authority; zpPayments.get(au2).paid = true; zpPayments.get(au2).verified = true;
r = await call('zarinpal', { action: 'verify', authority: au2 }, { key }); assert.equal(r.body.granted, true, '101 (already verified at the gateway) still counts once');
r = await call('zarinpal', { action: 'verify', authority: au2 }, { key }); assert.equal(r.body.granted, false);
r = await call('zarinpal', { action: 'verify', authority: 'bad' }, { key }); assert.equal(r.status, 400);
// through the relay: the call carries a signature the relay can check
process.env.ZARINPAL_RELAY_SECRET = 'relay-secret-1234567890';
r = await call('zarinpal', { action: 'create', callbackUrl: 'https://site.test/?zp=1' }, { key }); assert.equal(r.status, 200);
const ts = lastZarinpalHeaders['x-relay-ts'];
assert.equal(lastZarinpalHeaders['x-relay-sig'], createHmac('sha256', 'relay-secret-1234567890').update(`${ts}.${'/pg/v4/payment/request.json'}.${lastZarinpalBody}`).digest('hex'), 'the relay can verify the signature');
delete process.env.ZARINPAL_RELAY_SECRET;
r = await call('zarinpal', { action: 'create', callbackUrl: 'https://site.test/?zp=1' }, { key }); assert.equal(lastZarinpalHeaders['x-relay-sig'], undefined, 'no relay -> no signature headers');
console.log('ok zarinpal');

// ---------- public config ----------
r = await call('config', { action: 'public' }); assert.equal(r.status, 200);
assert.deepEqual(r.body.methods, { stripe: true, paypal: true, zarinpal: true }); assert.deepEqual(r.body.prices, { usd: '1.00', toman: 250000 }); assert.equal(r.body.packCredits, 5);
r = await call('config', { action: 'public' }, { headers: { 'x-vercel-ip-country': 'ir' } }); assert.equal(r.body.country, 'IR', 'country from the hosting header');
r = await call('config', { action: 'public' }, { headers: { 'x-vercel-ip-country': 'nonsense' } }); assert.equal(r.body.country, '');
r = await call('config', { action: 'public' }, { headers: { 'cf-ipcountry': 'DE' } }); assert.equal(r.body.country, 'DE', 'Cloudflare header works too');
r = await call('config', {}, { method: 'GET' }); assert.equal(r.status, 200, 'GET works: open /api/config in a browser'); assert.equal(r.body.version, 'global-3'); assert.equal(r.body.stripeMode, 'test'); assert.deepEqual(r.body.ready, { redis: true, gemini: true, email: true });
assert.equal(r.headers['Cache-Control'], 'no-store');
const savedKey = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY; r = await call('config', {}, { method: 'GET' }); assert.equal(r.body.methods.stripe, false); assert.equal(r.body.stripeMode, null); process.env.STRIPE_SECRET_KEY = savedKey;
process.env.STRIPE_SECRET_KEY = 'sk_live_abc'; r = await call('config', {}, { method: 'GET' }); assert.equal(r.body.stripeMode, 'live'); process.env.STRIPE_SECRET_KEY = savedKey;
r = await call('stripe', {}, { method: 'GET', key }); assert.equal(r.status, 405, 'only /api/config answers GET');
console.log('ok config');

// ---------- PayPal ----------
r = await call('paypal', { action: 'create', returnUrl: 'https://evil.test/x', cancelUrl: 'https://site.test/' }, { key }); assert.equal(r.status, 400, 'open redirect blocked');
r = await call('paypal', { action: 'create', returnUrl: 'https://site.test/?pp=1', cancelUrl: 'https://site.test/' }, { key }); assert.equal(r.status, 200); const oid = r.body.orderId;
r = await call('paypal', { action: 'capture', orderId: oid }, { key: other }); assert.equal(r.status, 404);
const pb0 = await credits(key);
r = await call('paypal', { action: 'capture', orderId: oid }, { key }); assert.equal(r.status, 402); assert.equal(await credits(key), pb0);
paypalOrders.get(oid).paid = true;
r = await call('paypal', { action: 'capture', orderId: oid }, { key }); assert.equal(r.body.granted, true); assert.equal(r.body.credits, pb0 + 5);
r = await call('paypal', { action: 'capture', orderId: oid }, { key }); assert.equal(r.body.granted, false);
r = await call('paypal', { action: 'create', returnUrl: 'https://site.test/', cancelUrl: 'https://site.test/' }, { key }); const oid2 = r.body.orderId; paypalOrders.get(oid2).paid = true; paypalOrders.get(oid2).amount = '0.01';
r = await call('paypal', { action: 'capture', orderId: oid2 }, { key }); assert.equal(r.status, 402, 'wrong amount refused');
console.log('ok paypal');

// ---------- Stripe (cards, Apple Pay, Google Pay) ----------
r = await call('stripe', { action: 'create', returnUrl: 'https://evil.test/x', cancelUrl: 'https://site.test/' }, { key }); assert.equal(r.status, 400, 'open redirect blocked');
r = await call('stripe', { action: 'create', returnUrl: 'https://site.test/?pay=stripe', cancelUrl: 'https://site.test/#/Credits' }, { key }); assert.equal(r.status, 200); assert.match(r.body.url, /^https:\/\/checkout\.stripe\.test\/c\/cs_test_/);
assert.equal(lastStripeCreate.mode, 'payment'); assert.equal(lastStripeCreate.locale, 'auto', 'no language given -> Stripe decides'); assert.equal(lastStripeCreate['line_items[0][price_data][unit_amount]'], '100'); assert.equal(lastStripeCreate['line_items[0][price_data][currency]'], 'usd');
assert.equal(lastStripeCreate.success_url, 'https://site.test/?pay=stripe&session_id={CHECKOUT_SESSION_ID}', 'Stripe fills in the session id');
const sid = r.body.url.split('/').pop(); const sb0 = await credits(key);
await call('stripe', { action: 'create', returnUrl: 'https://site.test/de/?pay=stripe', cancelUrl: 'https://site.test/de/Credits', locale: 'de' }, { key }); assert.equal(lastStripeCreate.locale, 'de', "Stripe's page opens in the visitor's language");
await call('stripe', { action: 'create', returnUrl: 'https://site.test/fa/?pay=stripe', cancelUrl: 'https://site.test/fa/Credits', locale: 'fa' }, { key }); assert.equal(lastStripeCreate.locale, 'auto', 'languages Stripe does not have fall back to auto');
await call('stripe', { action: 'create', returnUrl: 'https://site.test/x', cancelUrl: 'https://site.test/x', locale: 'xx&evil=1' }, { key }); assert.equal(lastStripeCreate.locale, 'auto', 'the language is checked against a fixed list');
r = await call('stripe', { action: 'verify', sessionId: 'nope' }, { key }); assert.equal(r.status, 400);
r = await call('stripe', { action: 'verify', sessionId: sid }, { key }); assert.equal(r.status, 402, 'not paid yet'); assert.equal(await credits(key), sb0);
stripeSessions.get(sid).payment_status = 'paid'; stripeSessions.get(sid).status = 'complete';
r = await call('stripe', { action: 'verify', sessionId: sid }, { key: other }); assert.equal(r.status, 404, "another account cannot redeem my payment");
r = await call('stripe', { action: 'verify', sessionId: sid }, { key }); assert.equal(r.status, 200); assert.equal(r.body.granted, true); assert.equal(r.body.credits, sb0 + 5);
r = await call('stripe', { action: 'verify', sessionId: sid }, { key }); assert.equal(r.body.granted, false, 'second verify gives nothing');
const mk = async () => { const x = await call('stripe', { action: 'create', returnUrl: 'https://site.test/', cancelUrl: 'https://site.test/' }, { key }); return x.body.url.split('/').pop(); };
const sidLow = await mk(); Object.assign(stripeSessions.get(sidLow), { payment_status: 'paid', status: 'complete', amount_total: 50 });
r = await call('stripe', { action: 'verify', sessionId: sidLow }, { key }); assert.equal(r.status, 402, 'wrong amount refused');
// webhook
const sign = (raw, t = Math.floor(Date.now() / 1000), secret = 'whsec_test_123') => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
const uidOf = (k) => store.get('k:' + createHash('sha256').update(k.replace(/-/g, '')).digest('hex'));
const sidW = await mk(); Object.assign(stripeSessions.get(sidW), { payment_status: 'paid', status: 'complete' });
const evt = (session, type = 'checkout.session.completed') => JSON.stringify({ id: 'evt_1', type, data: { object: session } });
let raw = evt(stripeSessions.get(sidW)); const wb0 = await credits(key);
r = await call('stripe-webhook', undefined, { raw, headers: { 'stripe-signature': sign(raw) } }); assert.equal(r.status, 200); assert.equal(r.body.granted, true); assert.equal(await credits(key), wb0 + 5, 'credits arrive even if the buyer never came back');
r = await call('stripe-webhook', undefined, { raw, headers: { 'stripe-signature': sign(raw) } }); assert.equal(r.body.granted, false, 'Stripe retries are harmless');
r = await call('stripe', { action: 'verify', sessionId: sidW }, { key }); assert.equal(r.body.granted, false, 'the page after the webhook gives nothing twice');
raw = evt(stripeSessions.get(sidW)); r = await call('stripe-webhook', undefined, { raw, headers: { 'stripe-signature': sign(raw, undefined, 'whsec_wrong') } }); assert.equal(r.status, 400, 'forged signature refused');
r = await call('stripe-webhook', undefined, { raw, headers: { 'stripe-signature': sign(raw, Math.floor(Date.now() / 1000) - 3600) } }); assert.equal(r.status, 400, 'old signature refused');
r = await call('stripe-webhook', undefined, { raw: raw + ' ', headers: { 'stripe-signature': sign(raw) } }); assert.equal(r.status, 400, 'a changed body refused');
const forged = { ...stripeSessions.get(sidW), id: 'cs_test_forged000001', metadata: { uid: 'does-not-exist' } }; raw = evt(forged);
r = await call('stripe-webhook', undefined, { raw, headers: { 'stripe-signature': sign(raw) } }); assert.equal(r.body.ignored, true, 'unknown account: ignored');
raw = evt(stripeSessions.get(sidLow)); r = await call('stripe-webhook', undefined, { raw, headers: { 'stripe-signature': sign(raw) } }); assert.equal(r.body.ignored, true, 'wrong amount: ignored');
raw = evt({ id: 'x' }, 'customer.created'); r = await call('stripe-webhook', undefined, { raw, headers: { 'stripe-signature': sign(raw) } }); assert.equal(r.body.ignored, true);
void uidOf;
console.log('ok stripe');

// ---------- Cafe Bazaar ----------
const b2 = await credits(key);
r = await call('bazaar', { action: 'redeem', productId: 'credits_5', purchaseToken: 'FAKE12345' }, { key }); assert.equal(r.status, 402);
r = await call('bazaar', { action: 'redeem', productId: 'credits_5', purchaseToken: 'BREFUND12345' }, { key }); assert.equal(r.status, 402);
r = await call('bazaar', { action: 'redeem', productId: 'x', purchaseToken: 'BPAID12345' }, { key }); assert.equal(r.status, 400);
r = await call('bazaar', { action: 'redeem', productId: 'credits_5', purchaseToken: 'bad token/../' }, { key }); assert.equal(r.status, 400);
r = await call('bazaar', { action: 'redeem', productId: 'credits_5', purchaseToken: 'BPAID12345' }, { key }); assert.equal(r.status, 200); assert.equal(r.body.credits, b2 + 5);
r = await call('bazaar', { action: 'redeem', productId: 'credits_5', purchaseToken: 'BPAID12345' }, { key: other }); assert.equal(r.body.granted, false);
r = await call('bazaar', { action: 'redeem', productId: 'credits_5', purchaseToken: 'BPAID99999' }, {}); assert.equal(r.status, 401);
console.log('ok bazaar');

// ---------- delete ----------
const keyDel = (await (async () => { const k = await anon(); await verifyEmail(k, 'del@x.test'); return k; })());
r = await call('account', { action: 'delete' }, { key: keyDel }); assert.equal(r.status, 200);
r = await call('account', { action: 'me' }, { key: keyDel }); assert.equal(r.status, 401);
console.log('ALL OK'); upstash.close(); ext.close(); process.exit(0);
