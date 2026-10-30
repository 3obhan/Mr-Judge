// Tests the built-in direct Redis client (RESP over TCP) against a small fake Redis server:
// AUTH, all commands the API uses, partial packets, unicode, big values, and reconnecting after the server hangs up.
import net from 'node:net';
import assert from 'node:assert/strict';

const store = new Map(); let authed = 0, connections = 0, dropNext = false, slow = false;
const sockets = new Set();
const server = net.createServer((sock) => {
  connections += 1; sockets.add(sock); sock.on('close', () => sockets.delete(sock));
  let buf = Buffer.alloc(0); let ok = false;
  const reply = (s) => {
    const b = Buffer.from(s);
    if (slow) { let i = 0; const t = setInterval(() => { sock.write(b.subarray(i, i + 3)); i += 3; if (i >= b.length) clearInterval(t); }, 1); } // dribble the bytes out
    else sock.write(b);
  };
  const bulk = (v) => (v === null || v === undefined ? '$-1\r\n' : `$${Buffer.byteLength(String(v))}\r\n${v}\r\n`);
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) { // parse one command (array of bulk strings)
      if (buf.length === 0 || buf[0] !== 42) break;
      let eol = buf.indexOf('\r\n'); if (eol < 0) break;
      const n = Number(buf.toString('utf8', 1, eol)); let p = eol + 2; const args = [];
      let incomplete = false;
      for (let i = 0; i < n; i += 1) {
        eol = buf.indexOf('\r\n', p); if (eol < 0) { incomplete = true; break; }
        const len = Number(buf.toString('utf8', p + 1, eol)); const start = eol + 2;
        if (buf.length < start + len + 2) { incomplete = true; break; }
        args.push(buf.toString('utf8', start, start + len)); p = start + len + 2;
      }
      if (incomplete) break;
      buf = buf.subarray(p);
      const [c, ...a] = args;
      if (dropNext && c !== 'AUTH') { dropNext = false; sock.destroy(); return; }
      if (c === 'AUTH') { if (a[a.length - 1] === 's3cret') { ok = true; authed += 1; reply('+OK\r\n'); } else reply('-WRONGPASS invalid password\r\n'); continue; }
      if (!ok) { reply('-NOAUTH Authentication required.\r\n'); continue; }
      switch (c) {
        case 'GET': reply(bulk(store.has(a[0]) && typeof store.get(a[0]) === 'string' ? store.get(a[0]) : null)); break;
        case 'SET': if (a.includes('NX') && store.has(a[0])) reply('$-1\r\n'); else { store.set(a[0], a[1]); reply('+OK\r\n'); } break;
        case 'DEL': reply(`:${store.delete(a[0]) ? 1 : 0}\r\n`); break;
        case 'INCR': { const v = Number(store.get(a[0]) ?? 0) + 1; store.set(a[0], String(v)); reply(`:${v}\r\n`); break; }
        case 'DECR': { const v = Number(store.get(a[0]) ?? 0) - 1; store.set(a[0], String(v)); reply(`:${v}\r\n`); break; }
        case 'INCRBY': { const v = Number(store.get(a[0]) ?? 0) + Number(a[1]); store.set(a[0], String(v)); reply(`:${v}\r\n`); break; }
        case 'EXPIRE': reply(':1\r\n'); break;
        case 'SADD': { const s = store.get(a[0]) || new Set(); s.add(a[1]); store.set(a[0], s); reply(':1\r\n'); break; }
        case 'SMEMBERS': { const m = [...(store.get(a[0]) || [])]; reply(`*${m.length}\r\n${m.map(bulk).join('')}`); break; }
        default: reply(`-ERR unknown command '${c}'\r\n`);
      }
    }
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
process.env.REDIS_URL = `redis://default:s3cret@127.0.0.1:${server.address().port}`;
for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
const { cmd, redisConfig } = await import(new URL('../api/_lib/redis.js', import.meta.url));
assert.equal(redisConfig().mode, 'tcp');

assert.equal(await cmd('SET', 'a', '1'), 'OK');
assert.equal(await cmd('GET', 'a'), '1'); assert.equal(await cmd('GET', 'missing'), null);
assert.equal(await cmd('SET', 'a', '2', 'NX'), null, 'NX on an existing key gives null');
assert.equal(await cmd('SET', 'b', 'x', 'NX'), 'OK');
assert.equal(await cmd('INCR', 'n'), 1); assert.equal(await cmd('DECR', 'n'), 0); assert.equal(await cmd('DECR', 'n'), -1);
assert.equal(await cmd('INCRBY', 'n', 5), 4); assert.equal(await cmd('EXPIRE', 'n', 60), 1);
await cmd('SADD', 's', 'k1'); await cmd('SADD', 's', 'k2'); assert.deepEqual(await cmd('SMEMBERS', 's'), ['k1', 'k2']); assert.deepEqual(await cmd('SMEMBERS', 'none'), []);
assert.equal(await cmd('DEL', 'a'), 1); assert.equal(await cmd('DEL', 'a'), 0);
const uni = 'سلام دنیا ✓ 😀'; await cmd('SET', 'u', uni); assert.equal(await cmd('GET', 'u'), uni, 'unicode round-trips');
const big = 'x'.repeat(200000); await cmd('SET', 'big', big); assert.equal((await cmd('GET', 'big')).length, 200000, 'big values');
assert.deepEqual(await Promise.all([cmd('INCR', 'p'), cmd('INCR', 'p'), cmd('INCR', 'p')]), [1, 2, 3], 'overlapping commands keep their order');
await assert.rejects(() => cmd('NOPE'), /unknown command/);
slow = true; assert.equal(await cmd('GET', 'u'), uni, 'replies that arrive in tiny pieces'); assert.deepEqual(await cmd('SMEMBERS', 's'), ['k1', 'k2']); slow = false;
assert.equal(connections, 1, 'one shared connection');

// the server hangs up while the function was "frozen": reconnect on the next command
await new Promise((r) => setTimeout(r, 3100)); for (const s of sockets) s.destroy(); await new Promise((r) => setTimeout(r, 50));
assert.equal(await cmd('GET', 'u'), uni, 'reconnected after the server closed the connection'); assert.equal(connections, 2);
await new Promise((r) => setTimeout(r, 3100)); dropNext = true;
assert.equal(await cmd('GET', 'u'), uni, 'retried once when a stale connection resets mid-command');
console.log('redis-tcp OK'); server.close(); process.exit(0);
