// Redis settings can come from the REST pair, from an Upstash connection string, or from any other redis:// URL.
import assert from 'node:assert/strict';
const clear = () => { for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'REDIS_URL', 'KV_URL', 'UPSTASH_REDIS_URL']) delete process.env[k]; };
const { redisConfig, redisConfigured } = await import(new URL('../api/_lib/redis.js', import.meta.url));

clear(); assert.equal(redisConfigured(), false);
process.env.REDIS_URL = 'rediss://default:AbC%2Bdef123@sharp-owl-12345.upstash.io:6379';
assert.deepEqual(redisConfig(), { mode: 'rest', url: 'https://sharp-owl-12345.upstash.io', token: 'AbC+def123' }, 'Upstash connection string -> REST address + token');
clear(); process.env.KV_URL = 'redis://default:pw@sharp-owl-12345.upstash.io:6379';
assert.equal(redisConfig().url, 'https://sharp-owl-12345.upstash.io');
clear(); process.env.REDIS_URL = 'redis://default:pw@redis-1234.c1.cloud.redislabs.com:6379';
assert.deepEqual(redisConfig(), { mode: 'tcp', url: process.env.REDIS_URL }, 'any other Redis uses the direct connection');
clear(); process.env.REDIS_URL = 'not a url'; assert.equal(redisConfigured(), false);
clear(); process.env.REDIS_URL = 'http://example.com'; assert.equal(redisConfigured(), false, 'only redis:// and rediss:// count');
clear(); process.env.UPSTASH_REDIS_REST_URL = 'https://a.upstash.io'; process.env.UPSTASH_REDIS_REST_TOKEN = 't'; process.env.REDIS_URL = 'rediss://default:other@b.upstash.io:6379';
assert.deepEqual(redisConfig(), { mode: 'rest', url: 'https://a.upstash.io', token: 't' }, 'the REST pair wins when both are set');
console.log('redis-url OK');
