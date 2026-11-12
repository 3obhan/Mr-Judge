/**
 * Redis access for the server (no npm package needed). Ways to configure it, in this order:
 *   1) UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (or KV_REST_API_URL + KV_REST_API_TOKEN): Upstash REST API
 *   2) Cloudflare only, no account to create: a D1 database bound as "DB" (Cloudflare Pages, api/_lib/redis-d1.js)
 *      or a Durable Object bound as "STORE" (Cloudflare Worker, cloudflare/store-do.js)
 *   3) REDIS_URL (or KV_URL) that points to xxxx.upstash.io: converted to the Upstash REST address + token automatically
 *   4) REDIS_URL (or KV_URL) = redis://default:PASSWORD@host:port  or  rediss://... (TLS): any other Redis, over a direct
 *      connection (a small built-in client below)
 */

const IN_WORKERS = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

export function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (url && token) return { mode: 'rest', url, token };
  if (globalThis.__REDIS_D1) return { mode: 'd1' };
  if (globalThis.__REDIS_DO) return { mode: 'do' };
  const conn = process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_URL || '';
  try {
    const u = new URL(conn);
    if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') return { mode: 'none' };
    if (/\.upstash\.io$/i.test(u.hostname) && u.password) {
      return { mode: 'rest', url: `https://${u.hostname}`, token: decodeURIComponent(u.password) };
    }
    if (u.hostname && !IN_WORKERS) return { mode: 'tcp', url: conn }; // direct TCP is not used inside Cloudflare Workers
  } catch { /* not a URL */ }
  return { mode: 'none' };
}

export const redisConfigured = () => redisConfig().mode !== 'none';

// ---------------------------------------------------------------- REST (Upstash)
async function restCmd({ url, token }, args) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.map(String)),
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok || data.error) throw new Error(`Redis: ${data.error || res.status}`);
  return data.result;
}

// ---------------------------------------------------------------- TCP (RESP2), one shared connection per server instance
const COMMAND_TIMEOUT_MS = 8000;
const CONNECT_TIMEOUT_MS = 8000;
const IDLE_RETRY_MS = 3000; // a connection that sat idle this long may have been closed by the server: retry once

/** Parses one RESP2 value from buf at pos. Returns [value, nextPos] or null if the data is not complete yet. */
function parseResp(buf, pos) {
  if (pos >= buf.length) return null;
  const type = String.fromCharCode(buf[pos]);
  const eol = buf.indexOf('\r\n', pos);
  if (eol === -1) return null;
  const line = buf.toString('utf8', pos + 1, eol);
  const next = eol + 2;
  if (type === '+') return [line, next];
  if (type === '-') return [new Error(`Redis: ${line}`), next];
  if (type === ':') return [Number(line), next];
  if (type === '$') {
    const len = Number(line);
    if (len === -1) return [null, next];
    if (buf.length < next + len + 2) return null;
    return [buf.toString('utf8', next, next + len), next + len + 2];
  }
  if (type === '*') {
    const n = Number(line);
    if (n === -1) return [null, next];
    const out = []; let p = next;
    for (let i = 0; i < n; i += 1) {
      const r = parseResp(buf, p);
      if (!r) return null;
      out.push(r[0]); p = r[1];
    }
    return [out, p];
  }
  throw new Error(`Redis: unexpected reply type "${type}"`);
}

const encode = (args) => {
  let s = `*${args.length}\r\n`;
  for (const a of args) { const v = String(a); s += `$${Buffer.byteLength(v)}\r\n${v}\r\n`; }
  return Buffer.from(s);
};

let conn = null; // { socket, pending: [], buf, lastUsed }

async function connect(urlString) {
  // Module names are built at run time so bundlers (Cloudflare's wrangler) do not try to bundle them: direct TCP is only used on Node
  const netName = 'node:net';
  const tlsName = 'node:tls';
  const net = (await import(/* @vite-ignore */ netName)).default;
  const tls = (await import(/* @vite-ignore */ tlsName)).default;
  const u = new URL(urlString);
  const port = Number(u.port) || 6379;
  const host = u.hostname;
  return new Promise((resolve, reject) => {
    const socket = u.protocol === 'rediss:' ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    const c = { socket, pending: [], buf: Buffer.alloc(0), lastUsed: Date.now() };
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Redis: connect timeout')); }, CONNECT_TIMEOUT_MS);
    const fail = (err) => {
      clearTimeout(timer);
      if (conn === c) conn = null;
      for (const p of c.pending.splice(0)) p.reject(err);
      reject(err);
    };
    socket.on('data', (chunk) => {
      c.buf = Buffer.concat([c.buf, chunk]);
      for (;;) {
        const r = parseResp(c.buf, 0);
        if (!r) break;
        c.buf = c.buf.subarray(r[1]);
        const p = c.pending.shift();
        if (p) (r[0] instanceof Error ? p.reject(r[0]) : p.resolve(r[0]));
      }
    });
    socket.on('error', fail);
    socket.on('close', () => fail(Object.assign(new Error('Redis: connection closed'), { closed: true })));
    socket.setNoDelay(true);
    socket.once(u.protocol === 'rediss:' ? 'secureConnect' : 'connect', async () => {
      clearTimeout(timer);
      conn = c;
      try {
        const user = decodeURIComponent(u.username || '');
        const pass = decodeURIComponent(u.password || '');
        if (pass) await send(c, user && user !== 'default' ? ['AUTH', user, pass] : ['AUTH', pass]);
        const db = u.pathname.replace('/', '');
        if (/^\d+$/.test(db) && db !== '0') await send(c, ['SELECT', db]);
        resolve(c);
      } catch (e) { socket.destroy(); reject(e); }
    });
  });
}

function send(c, args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { c.socket.destroy(); reject(new Error('Redis: command timeout')); }, COMMAND_TIMEOUT_MS);
    c.pending.push({
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    c.lastUsed = Date.now();
    c.socket.write(encode(args), (err) => { if (err) { clearTimeout(timer); reject(err); } });
  });
}

async function tcpCmd({ url }, args) {
  for (let attempt = 0; ; attempt += 1) {
    const idleFor = conn ? Date.now() - conn.lastUsed : 0;
    try {
      if (!conn || conn.socket.destroyed) conn = await connect(url);
      return await send(conn, args.map(String));
    } catch (e) {
      // A stale connection (closed while the function was frozen): reconnect and try once more
      if (attempt === 0 && (e.closed || e.code === 'ECONNRESET' || e.code === 'EPIPE') && idleFor >= IDLE_RETRY_MS) {
        conn = null;
        continue;
      }
      throw e;
    }
  }
}

/** Run one Redis command, e.g. cmd('SET', 'key', 'value', 'EX', 60). Returns the reply like Upstash's `result`. */
export async function cmd(...args) {
  const cfg = redisConfig();
  if (cfg.mode === 'rest') return restCmd(cfg, args);
  if (cfg.mode === 'd1') {
    const { executeCommandD1 } = await import('./redis-d1.js');
    return executeCommandD1(globalThis.__REDIS_D1, args.map(String));
  }
  if (cfg.mode === 'do') {
    const ns = globalThis.__REDIS_DO;
    return ns.get(ns.idFromName('main')).cmd(args.map(String));
  }
  if (cfg.mode === 'tcp') return tcpCmd(cfg, args);
  throw new Error('Redis is not configured');
}
