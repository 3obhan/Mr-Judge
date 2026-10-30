// The built-in Cloudflare database: Redis commands on a plain key-value storage.
import assert from 'node:assert/strict';
const { executeCommand } = await import(new URL('../cloudflare/redis-lite.js', import.meta.url));

const map = new Map();
const storage = { get: async (k) => structuredClone(map.get(k)), put: async (k, v) => { map.set(k, structuredClone(v)); }, delete: async (k) => map.delete(k) };
let now = 1_000_000;
const run = (...a) => executeCommand(storage, a, now);

assert.equal(await run('GET', 'a'), null);
assert.equal(await run('SET', 'a', '1'), 'OK'); assert.equal(await run('GET', 'a'), '1');
assert.equal(await run('SET', 'a', '2', 'NX'), null, 'NX does not overwrite'); assert.equal(await run('GET', 'a'), '1');
assert.equal(await run('SET', 'b', 'x', 'NX'), 'OK', 'NX on a new key');
assert.equal(await run('SET', 5, 7), 'OK', 'numbers are stored as text'); assert.equal(await run('GET', '5'), '7');
assert.equal(await run('DEL', 'a'), 1); assert.equal(await run('DEL', 'a'), 0); assert.equal(await run('GET', 'a'), null);
// counters
assert.equal(await run('INCR', 'n'), 1); assert.equal(await run('INCR', 'n'), 2); assert.equal(await run('DECR', 'n'), 1);
assert.equal(await run('DECR', 'neg'), -1, 'DECR on a missing key starts from 0'); assert.equal(await run('INCRBY', 'n', 5), 6); assert.equal(await run('DECRBY', 'n', 2), 4);
assert.equal(await run('GET', 'n'), '4', 'counters read back as text');
await run('SET', 'word', 'abc'); await assert.rejects(() => run('INCR', 'word'), /not an integer/);
// expiry
assert.equal(await run('SET', 't', 'v', 'EX', 10), 'OK'); assert.equal(await run('GET', 't'), 'v');
now += 9_000; assert.equal(await run('GET', 't'), 'v'); now += 2_000; assert.equal(await run('GET', 't'), null, 'expired'); assert.equal(map.has('t'), false, 'and removed');
assert.equal(await run('SET', 't', 'again', 'NX'), 'OK', 'an expired key counts as missing for NX');
await run('SET', 'c', '1', 'EX', 10); await run('INCR', 'c'); now += 11_000; assert.equal(await run('GET', 'c'), null, 'INCR keeps the expiry');
assert.equal(await run('EXPIRE', 'nothing', 5), 0); await run('SET', 'e', '1'); assert.equal(await run('EXPIRE', 'e', 5), 1); now += 6_000; assert.equal(await run('GET', 'e'), null);
// sets
assert.deepEqual(await run('SMEMBERS', 's'), []); assert.equal(await run('SADD', 's', 'x'), 1); assert.equal(await run('SADD', 's', 'x'), 0); assert.equal(await run('SADD', 's', 'y'), 1);
assert.deepEqual(await run('SMEMBERS', 's'), ['x', 'y']); assert.equal(await run('GET', 's'), null, 'a set is not a string'); assert.equal(await run('DEL', 's'), 1); assert.deepEqual(await run('SMEMBERS', 's'), []);
await assert.rejects(() => run('FLUSHALL', 'x'), /unknown command/);
assert.equal(await run('get', 'b'), 'x', 'command names are case-insensitive');
// "spend one credit" style sequence never goes below zero when the app undoes a failed decrement
await run('SET', 'credits', '1'); assert.equal(await run('DECR', 'credits'), 0); assert.equal(await run('DECR', 'credits'), -1); assert.equal(await run('INCR', 'credits'), 0);
console.log('redis-lite OK');
