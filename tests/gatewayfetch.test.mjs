// Calls to the payment gateway through a static-IP HTTP proxy (like Fixie): HTTPS via a CONNECT tunnel, passwords, errors.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const { gatewayFetch, fetchViaProxy, proxyUrlFromEnv } = await import(new URL('../api/_lib/gatewayFetch.js', import.meta.url));

// a throw-away certificate for "localhost"
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-'));
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}/k.pem`, '-out', `${dir}/c.pem`, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
} catch (e) { console.log('gatewayfetch SKIPPED (no openssl):', e.message); process.exit(0); }
const key = fs.readFileSync(`${dir}/k.pem`); const cert = fs.readFileSync(`${dir}/c.pem`);

const seenByTarget = [];
const echo = (req, res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => {
  seenByTarget.push({ method: req.method, url: req.url, body: d, type: req.headers['content-type'], host: req.headers.host });
  if (req.url === '/bad') { res.writeHead(400, { 'content-type': 'application/json' }); return res.end('{"result":102}'); }
  res.writeHead(200, { 'content-type': 'application/json', 'x-test': 'yes' }); res.end(JSON.stringify({ result: 100, trackId: 42, echoed: d }));
}); };
const tlsTarget = https.createServer({ key, cert }, echo); const plainTarget = http.createServer(echo);
await Promise.all([new Promise((r) => tlsTarget.listen(0, '127.0.0.1', r)), new Promise((r) => plainTarget.listen(0, '127.0.0.1', r))]);

// the proxy: CONNECT tunnels (HTTPS) and absolute-URI requests (HTTP), both need "Proxy-Authorization: Basic fixie:s3cret"
const WANT = `Basic ${Buffer.from('fixie:s3cret').toString('base64')}`; const proxyLog = [];
const proxy = http.createServer((req, res) => {
  proxyLog.push({ kind: 'http', url: req.url, auth: req.headers['proxy-authorization'] });
  if (req.headers['proxy-authorization'] !== WANT) { res.writeHead(407); return res.end(); }
  const u = new URL(req.url);
  const fwd = { ...req.headers }; delete fwd['proxy-authorization'];
  const up = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method: req.method, headers: fwd }, (ur) => { res.writeHead(ur.statusCode, ur.headers); ur.pipe(res); });
  req.pipe(up);
});
proxy.on('connect', (req, client, head) => {
  proxyLog.push({ kind: 'connect', url: req.url, auth: req.headers['proxy-authorization'] });
  if (req.headers['proxy-authorization'] !== WANT) { client.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n'); return; }
  const [host, port] = req.url.split(':'); const up = net.connect(Number(port), host, () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(client); client.pipe(up); });
  up.on('error', () => client.destroy());
});
await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
const PROXY = `http://fixie:s3cret@127.0.0.1:${proxy.address().port}`;
const httpsUrl = (p) => `https://localhost:${tlsTarget.address().port}${p}`; const httpUrl = (p) => `http://127.0.0.1:${plainTarget.address().port}${p}`;
const post = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body });

try {
  // 1) HTTPS gateway through the CONNECT tunnel (what happens in production)
  let r = await fetchViaProxy(httpsUrl('/v1/request'), post('{"merchant":"m","amount":2500000}'), PROXY, { ca: cert });
  assert.equal(r.status, 200); const j = await r.json(); assert.equal(j.result, 100); assert.equal(j.echoed, '{"merchant":"m","amount":2500000}', 'the body arrives unchanged');
  assert.equal(r.headers.get('x-test'), 'yes', 'response headers are passed on');
  assert.deepEqual(seenByTarget.at(-1), { method: 'POST', url: '/v1/request', body: '{"merchant":"m","amount":2500000}', type: 'application/json', host: `localhost:${tlsTarget.address().port}` });
  assert.deepEqual(proxyLog.at(-1), { kind: 'connect', url: `localhost:${tlsTarget.address().port}`, auth: WANT }, 'a tunnel to the gateway, with the proxy password');
  // 2) UTF-8 body, 4xx answers are returned (not thrown)
  r = await fetchViaProxy(httpsUrl('/bad'), post('{"description":"تحلیل ✓"}'), PROXY, { ca: cert }); assert.equal(r.status, 400); assert.equal((await r.json()).result, 102);
  assert.equal(seenByTarget.at(-1).body, '{"description":"تحلیل ✓"}');
  // 3) wrong proxy password
  await assert.rejects(() => fetchViaProxy(httpsUrl('/v1/request'), post('{}'), `http://fixie:wrong@127.0.0.1:${proxy.address().port}`, { ca: cert }), (e) => e.proxyStatus === 407);
  // 4) plain HTTP target (absolute address given to the proxy)
  r = await fetchViaProxy(httpUrl('/v1/verify'), post('{"trackId":42}'), PROXY); assert.equal(r.status, 200); assert.equal((await r.json()).echoed, '{"trackId":42}');
  assert.deepEqual(proxyLog.at(-1), { kind: 'http', url: httpUrl('/v1/verify'), auth: WANT });
  // 5) certificate is checked: an untrusted gateway certificate is refused
  await assert.rejects(() => fetchViaProxy(httpsUrl('/v1/request'), post('{}'), PROXY), /self[- ]signed|unable to verify|certificate/i);
  // 6) proxy not reachable
  const dead = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  await assert.rejects(() => fetchViaProxy(httpsUrl('/v1/request'), post('{}'), `http://fixie:s3cret@127.0.0.1:${dead}`, { ca: cert }), /ECONNREFUSED/);
  // 7) gatewayFetch: the proxy only when FIXIE_URL (or GATEWAY_PROXY_URL) is set, a plain fetch otherwise
  delete process.env.FIXIE_URL; delete process.env.GATEWAY_PROXY_URL; assert.equal(proxyUrlFromEnv(), '');
  const n = proxyLog.length; r = await gatewayFetch(httpUrl('/v1/request'), post('{"a":1}')); assert.equal((await r.json()).result, 100); assert.equal(proxyLog.length, n, 'no proxy variable: no proxy');
  process.env.FIXIE_URL = PROXY; assert.equal(proxyUrlFromEnv(), PROXY);
  r = await gatewayFetch(httpUrl('/v1/request'), post('{"a":2}')); assert.equal((await r.json()).result, 100); assert.equal(proxyLog.length, n + 1, 'with FIXIE_URL the call goes through the proxy');
  process.env.FIXIE_URL = 'not a url'; assert.equal(proxyUrlFromEnv(), '', 'a malformed value is ignored');
  delete process.env.FIXIE_URL; process.env.GATEWAY_PROXY_URL = PROXY; assert.equal(proxyUrlFromEnv(), PROXY);
  console.log('gatewayfetch OK');
} finally { tlsTarget.close(); plainTarget.close(); proxy.close(); }
process.exit(0);
