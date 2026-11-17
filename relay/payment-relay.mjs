/**
 * Payment relay (Zibal): a tiny server for a machine with a FIXED public IP address.
 *
 * Why: Iranian payment gateways only accept payment requests from the IP address you registered in their panel. Vercel and
 * Cloudflare have no fixed outbound IP. If you do not use a static-IP proxy service (Fixie, see api/_lib/gatewayFetch.js), run this
 * on a small server with a fixed IP: the site sends the two calls ("create payment" and "verify payment") to this relay, and
 * the relay forwards them to Zibal. Zibal then sees THIS machine's IP: register it in the Zibal panel.
 *   Site side:  ZIBAL_API_BASE=https://pay.yourdomain.com/zibal    ZIBAL_RELAY_SECRET=<the same text as RELAY_SECRET>
 *
 * Safety: it only forwards /zibal/v1/request and /zibal/v1/verify, and only requests signed with the shared secret
 * (HMAC, 5 minute window), so nobody else can use it. It holds no keys of its own. Use HTTPS in front of it (see راهنما.md).
 *
 * Run (Node 18+):   RELAY_SECRET=<long random text> node payment-relay.mjs          (PORT defaults to 8080)
 */
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.RELAY_SECRET || '';
const ZIBAL_UPSTREAM = String(process.env.ZIBAL_UPSTREAM_BASE || 'https://gateway.zibal.ir').replace(/\/$/, '');
const ROUTES = [{ prefix: '/zibal', upstream: ZIBAL_UPSTREAM, paths: ['/v1/request', '/v1/verify'] }];
const MAX_BODY = 64 * 1024;
const WINDOW_SECONDS = 300;

if (SECRET.length < 16) {
  console.error('Set RELAY_SECRET to a long random text (at least 16 characters).');
  process.exit(1);
}

function resolveRoute(url) {
  for (const r of ROUTES) {
    if (url.startsWith(`${r.prefix}/`) && r.paths.includes(url.slice(r.prefix.length))) return { upstream: r.upstream, path: url.slice(r.prefix.length) };
  }
  return null;
}

const sign = (ts, path, body) => createHmac('sha256', SECRET).update(`${ts}.${path}.${body}`).digest('hex');

function signatureOk(req, path, body) {
  const ts = String(req.headers['x-relay-ts'] || '');
  const sig = String(req.headers['x-relay-sig'] || '');
  if (!/^\d{9,12}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > WINDOW_SECONDS) return false;
  const expected = sign(ts, path, body);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

const server = http.createServer((req, res) => {
  const reply = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true });
  const route = req.method === 'POST' ? resolveRoute(req.url) : null;
  if (!route) return reply(404, { error: 'not found' });

  const chunks = []; let size = 0; let tooBig = false;
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { tooBig = true; req.destroy(); } else chunks.push(c); });
  req.on('error', () => {});
  req.on('end', async () => {
    if (tooBig) return;
    const body = Buffer.concat(chunks).toString('utf8');
    if (!signatureOk(req, req.url, body)) return reply(403, { error: 'bad signature' });
    try {
      const upstream = await fetch(`${route.upstream}${route.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(15000),
      });
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(await upstream.text());
    } catch (e) {
      console.error('upstream error:', e.message);
      reply(502, { error: 'could not reach the gateway' });
    }
  });
});
server.on('clientError', (_e, socket) => socket.destroy());
server.listen(PORT, () => console.log(`Payment relay listening on port ${PORT}, forwarding /zibal to ${ZIBAL_UPSTREAM}`));
