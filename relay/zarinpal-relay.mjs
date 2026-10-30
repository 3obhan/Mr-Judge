/**
 * ZarinPal relay: a tiny server for a machine with a FIXED public IP address.
 *
 * Why: ZarinPal only accepts payment requests from the IP address you registered in its panel. Vercel has no fixed outbound
 * IP, so the site sends the two ZarinPal calls ("create payment" and "verify payment") to this relay, and the relay forwards
 * them to ZarinPal. ZarinPal then sees THIS machine's IP: register it in the ZarinPal panel.
 *
 * Safety: it only forwards those two paths, and only requests signed with the shared secret (HMAC, 5 minute window), so
 * nobody else can use it. It holds no keys of its own. Use HTTPS in front of it (see راهنما.md) so the traffic is encrypted.
 *
 * Run (Node 18+):   RELAY_SECRET=<long random text> node zarinpal-relay.mjs          (PORT defaults to 8080)
 * Vercel side:      ZARINPAL_API_BASE=https://pay.yourdomain.com   ZARINPAL_RELAY_SECRET=<the same text>
 */
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.RELAY_SECRET || '';
const UPSTREAM = String(process.env.UPSTREAM_BASE || 'https://payment.zarinpal.com').replace(/\/$/, '');
const ALLOWED = new Set(['/pg/v4/payment/request.json', '/pg/v4/payment/verify.json']);
const MAX_BODY = 64 * 1024;
const WINDOW_SECONDS = 300;

if (SECRET.length < 16) {
  console.error('Set RELAY_SECRET to a long random text (at least 16 characters).');
  process.exit(1);
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
  if (req.method !== 'POST' || !ALLOWED.has(req.url)) return reply(404, { error: 'not found' });

  const chunks = []; let size = 0; let tooBig = false;
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { tooBig = true; req.destroy(); } else chunks.push(c); });
  req.on('error', () => {});
  req.on('end', async () => {
    if (tooBig) return;
    const body = Buffer.concat(chunks).toString('utf8');
    if (!signatureOk(req, req.url, body)) return reply(403, { error: 'bad signature' });
    try {
      const upstream = await fetch(`${UPSTREAM}${req.url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'ZarinPal Rest Api v4' },
        body,
        signal: AbortSignal.timeout(15000),
      });
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(await upstream.text());
    } catch (e) {
      console.error('upstream error:', e.message);
      reply(502, { error: 'could not reach ZarinPal' });
    }
  });
});
server.on('clientError', (_e, socket) => socket.destroy());
server.listen(PORT, () => console.log(`ZarinPal relay listening on port ${PORT}, forwarding to ${UPSTREAM}`));
