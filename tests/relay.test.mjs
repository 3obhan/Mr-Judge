// The payment relay: forwards only the two Zibal paths, only for signed requests.
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const SECRET = 'relay-test-secret-0123456789';
const seen = [];
const upstream = http.createServer((req, res) => {
  let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
    seen.push({ url: req.url, body: d });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ result: 100, trackId: 123456, message: 'success' }));
  });
});
await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
const free = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const child = spawn(process.execPath, [fileURLToPath(new URL('../relay/payment-relay.mjs', import.meta.url))], {
  env: { ...process.env, RELAY_SECRET: SECRET, PORT: String(free), ZIBAL_UPSTREAM_BASE: `http://127.0.0.1:${upstream.address().port}` }, stdio: 'ignore',
});
for (let i = 0; i < 50; i += 1) { try { if ((await fetch(`http://127.0.0.1:${free}/health`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 100)); }

const sign = (ts, path, body, secret = SECRET) => createHmac('sha256', secret).update(`${ts}.${path}.${body}`).digest('hex');
const post = (path, body, { ts = Math.floor(Date.now() / 1000), sig } = {}) =>
  fetch(`http://127.0.0.1:${free}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-relay-ts': String(ts), 'x-relay-sig': sig ?? sign(ts, path, body) }, body });
try {
  const body = JSON.stringify({ merchant: 'm', amount: 2500000, callbackUrl: 'https://x.test/' });
  let r = await post('/zibal/v1/request', body); assert.equal(r.status, 200); assert.equal((await r.json()).result, 100, "the gateway's answer is passed on");
  assert.equal(seen.at(-1).url, '/v1/request', 'the prefix is removed before forwarding'); assert.equal(seen.at(-1).body, body, 'the body is forwarded unchanged');
  r = await post('/zibal/v1/verify', body); assert.equal(r.status, 200); assert.equal(seen.at(-1).url, '/v1/verify');
  const n = seen.length; const tsNow = Math.floor(Date.now() / 1000);
  r = await post('/zibal/v1/request', body, { sig: 'f'.repeat(64) }); assert.equal(r.status, 403, 'wrong signature');
  r = await post('/zibal/v1/request', body, { sig: sign(tsNow, '/zibal/v1/request', body, 'other-secret-0123456789') }); assert.equal(r.status, 403, 'signed with another secret');
  r = await post('/zibal/v1/request', body + ' ', { ts: tsNow, sig: sign(tsNow, '/zibal/v1/request', body) }); assert.equal(r.status, 403, 'a body that does not match the signature');
  r = await post('/zibal/v1/request', body, { ts: tsNow - 3600 }); assert.equal(r.status, 403, 'old request (replay)');
  r = await post('/zibal/v1/verify', body, { sig: sign(tsNow, '/zibal/v1/request', body) }); assert.equal(r.status, 403, 'a signature for another path');
  assert.equal(seen.length, n, 'nothing wrong reaches the gateway');
  r = await post('/zibal/v1/refund', body); assert.equal(r.status, 404, 'only request and verify are forwarded');
  r = await post('/v1/request', body); assert.equal(r.status, 404, 'paths need the /zibal prefix');
  r = await post('/pg/v4/payment/request.json', body); assert.equal(r.status, 404, 'other gateways are not forwarded');
  r = await fetch(`http://127.0.0.1:${free}/zibal/v1/request`); assert.equal(r.status, 404, 'GET is not forwarded');
  r = await fetch(`http://127.0.0.1:${free}/health`); assert.equal(r.status, 200);
  console.log('relay OK');
} finally { child.kill(); upstream.close(); }
process.exit(0);
