// The Cloudflare Pages database: Redis commands on D1 (SQLite), tested on real SQLite.
import assert from 'node:assert/strict';
let makeD1;
try { ({ makeD1 } = await import('./shim-d1.mjs')); } catch (e) { console.log('redis-d1 SKIPPED (this Node has no node:sqlite):', e.message); process.exit(0); }
const { executeCommandD1 } = await import(new URL('../api/_lib/redis-d1.js', import.meta.url));
const db = makeD1(); let now = 1_000_000;
const run = (...a) => executeCommandD1(db, a, now);

assert.equal(await run('GET', 'a'), null);
assert.equal(await run('SET', 'a', '1'), 'OK'); assert.equal(await run('GET', 'a'), '1');
assert.equal(await run('SET', 'a', '2', 'NX'), null, 'NX does not overwrite'); assert.equal(await run('GET', 'a'), '1');
assert.equal(await run('SET', 'b', 'x', 'NX'), 'OK'); assert.equal(await run('SET', 5, 7), 'OK'); assert.equal(await run('GET', '5'), '7');
assert.equal(await run('DEL', 'a'), 1); assert.equal(await run('DEL', 'a'), 0); assert.equal(await run('GET', 'a'), null);
assert.equal(await run('INCR', 'n'), 1); assert.equal(await run('INCR', 'n'), 2); assert.equal(await run('DECR', 'n'), 1);
assert.equal(await run('DECR', 'neg'), -1); assert.equal(await run('INCRBY', 'n', 5), 6); assert.equal(await run('DECRBY', 'n', 2), 4); assert.equal(await run('GET', 'n'), '4');
// expiry
assert.equal(await run('SET', 't', 'v', 'EX', 10), 'OK'); now += 9_000; assert.equal(await run('GET', 't'), 'v'); now += 2_000; assert.equal(await run('GET', 't'), null, 'expired');
assert.equal(await run('SET', 't', 'again', 'NX'), 'OK', 'an expired key counts as missing for NX'); assert.equal(await run('GET', 't'), 'again');
await run('SET', 'c', '1', 'EX', 10); assert.equal(await run('INCR', 'c'), 2); now += 11_000; assert.equal(await run('GET', 'c'), null, 'INCR keeps the expiry');
assert.equal(await run('INCR', 'c'), 1, 'counting an expired key starts again at 1');
assert.equal(await run('EXPIRE', 'nothing', 5), 0); await run('SET', 'e', '1'); assert.equal(await run('EXPIRE', 'e', 5), 1); now += 6_000; assert.equal(await run('GET', 'e'), null);
// sets
assert.deepEqual(await run('SMEMBERS', 's'), []); assert.equal(await run('SADD', 's', 'x'), 1); assert.equal(await run('SADD', 's', 'x'), 0); assert.equal(await run('SADD', 's', 'y'), 1);
assert.deepEqual(await run('SMEMBERS', 's'), ['x', 'y']); assert.equal(await run('GET', 's'), null);
assert.equal(await run('SADD', 'r', 'a', 'b', 'c'), 3); assert.equal(await run('SREM', 'r', 'b'), 1); assert.equal(await run('SREM', 'r', 'b'), 0); assert.deepEqual(await run('SMEMBERS', 'r'), ['a', 'c']);
assert.equal(await run('DEL', 's'), 1, 'DEL removes a set too'); assert.deepEqual(await run('SMEMBERS', 's'), []);
await assert.rejects(() => run('FLUSHALL', 'x'), /unknown command/);
assert.equal(await run('get', 'b'), 'x', 'command names are case-insensitive');
const uni = 'سلام ✓ 😀'; await run('SET', 'u', uni); assert.equal(await run('GET', 'u'), uni);
// many requests at the same time: no lost updates, and "spend a credit" never goes below zero when undone
await run('SET', 'credits', '3'); const r = await Promise.all(Array.from({ length: 5 }, () => run('DECR', 'credits')));
assert.deepEqual([...r].sort((a, b) => b - a), [2, 1, 0, -1, -2], 'every decrement counted once');
await run('SET', 'cnt', '0'); await Promise.all(Array.from({ length: 50 }, () => run('INCR', 'cnt'))); assert.equal(await run('GET', 'cnt'), '50');
const flags = await Promise.all(Array.from({ length: 10 }, () => run('SET', 'once', '1', 'NX'))); assert.equal(flags.filter((f) => f === 'OK').length, 1, 'only one caller wins a SET NX');
console.log('redis-d1 OK');
