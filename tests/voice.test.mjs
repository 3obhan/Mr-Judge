// Voice-to-text: a forgotten account key is replaced automatically, and every failure gets the right message.
import { register } from 'node:module';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.__ENV = {};
globalThis.FileReader = class { // minimal browser FileReader for Node
  readAsDataURL(blob) { blob.arrayBuffer().then((buf) => { this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
};
register('./loader.mjs', import.meta.url);

let validKey = null; let accountMode = 'ok'; let geminiMode = 'ok'; const calls = [];
globalThis.fetch = async (url, init) => {
  const u = String(url); const auth = init?.headers?.Authorization || '';
  calls.push({ u, auth });
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
  if (u.endsWith('/api/account')) {
    if (accountMode === 'notconfigured') return json({ error: 'ACCOUNTS_NOT_CONFIGURED' }, 503);
    validKey = 'NEWK-AAAA-BBBB-CCCC-DDDD'; return json({ accountKey: validKey, credits: 2 });
  }
  if (u.endsWith('/api/gemini')) {
    if (geminiMode === 'nokey') return json({ error: 'GEMINI_API_KEY is not set on the server' }, 500);
    if (geminiMode === 'toolarge') return new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 });
    if (geminiMode === 'dailylimit') return json({ error: 'DAILY_LIMIT' }, 429);
    if (auth !== `Bearer ${validKey}` || geminiMode === 'always401') return json({ error: 'INVALID_ACCOUNT' }, 401);
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ transcript: 'سلام دنیا' }) }] } }] });
  }
  return json({}, 404);
};
const { transcribeAudio } = await import(new URL('../src/lib/geminiClient.js', import.meta.url));
const { voiceErrorKey } = await import(new URL('../src/lib/voiceErrors.js', import.meta.url));
const blob = () => new Blob([new Uint8Array(200)], { type: 'audio/wav' });
const geminiCalls = () => calls.filter((c) => c.u.endsWith('/api/gemini')).length;

// 1) the browser holds a key the server has never heard of (e.g. the database was replaced): fresh account, then it works
store.set('judge_account_key_v1', 'OLD1-AAAA-BBBB-CCCC-DDDD'); validKey = 'SOMEONE-ELSE';
let text = await transcribeAudio(blob(), { language: 'fa' });
assert.equal(text, 'سلام دنیا', 'the recording is transcribed after the automatic fresh start');
assert.deepEqual(calls.map((c) => c.u.split('/api/')[1]), ['gemini', 'account', 'gemini'], 'asked, got 401, made a new account, asked again');
assert.equal(calls[0].auth, 'Bearer OLD1-AAAA-BBBB-CCCC-DDDD'); assert.equal(calls[2].auth, 'Bearer NEWK-AAAA-BBBB-CCCC-DDDD'); assert.equal(store.get('judge_account_key_v1'), 'NEWK-AAAA-BBBB-CCCC-DDDD');
calls.length = 0; text = await transcribeAudio(blob(), { language: 'en' }); assert.equal(text, 'سلام دنیا'); assert.equal(calls.length, 1, 'the next recording needs no retry');

// 2) the server keeps saying 401: only ONE retry, then a clear error
geminiMode = 'always401'; calls.length = 0;
await assert.rejects(() => transcribeAudio(blob(), { language: 'en' }), (e) => { assert.equal(e.status, 401); assert.equal(e.apiError, 'INVALID_ACCOUNT'); assert.equal(voiceErrorKey(e), 'generic'); return true; });
assert.equal(geminiCalls(), 2, 'exactly one retry, no loop'); geminiMode = 'ok';

// 3) the server has no database: the visitor is told so (not "API key")
store.clear(); accountMode = 'notconfigured';
await assert.rejects(() => transcribeAudio(blob(), { language: 'en' }), (e) => { assert.equal(e.status, 503); assert.equal(voiceErrorKey(e), 'noDatabase'); return true; });
accountMode = 'ok';
// 4) the server has no AI key: told clearly, and not retried / not tried on other models
geminiMode = 'nokey'; store.clear(); calls.length = 0; const t0 = Date.now();
await assert.rejects(() => transcribeAudio(blob(), { language: 'en' }), (e) => { assert.equal(e.status, 500); assert.equal(voiceErrorKey(e), 'noAiKey'); return true; });
assert.equal(geminiCalls(), 1, 'a setup problem is not retried'); assert.ok(Date.now() - t0 < 900, 'and the visitor does not wait for pointless retries');
// 5) other failures
geminiMode = 'toolarge'; await assert.rejects(() => transcribeAudio(blob(), { language: 'en' }), (e) => { assert.equal(voiceErrorKey(e), 'tooLong'); return true; });
geminiMode = 'dailylimit'; await assert.rejects(() => transcribeAudio(blob(), { language: 'en' }), (e) => { assert.equal(voiceErrorKey(e), 'quota'); return true; });

// the mapper on its own
const k = voiceErrorKey;
assert.equal(k({ status: 429 }), 'quota'); assert.equal(k({ status: 404 }), 'server'); assert.equal(k({ status: 405 }), 'server'); assert.equal(k({ status: 413 }), 'tooLong');
assert.equal(k({ status: 503, apiError: 'ACCOUNTS_NOT_CONFIGURED' }), 'noDatabase'); assert.equal(k({ status: 500, apiError: 'SERVER_ERROR' }), 'noDatabase', 'a broken database');
assert.equal(k({ status: 500, apiError: 'GEMINI_API_KEY is not set on the server' }), 'noAiKey');
assert.equal(k({ status: 400, detail: 'HTTP 400 - API key not valid. Please pass a valid API key.' }), 'key'); assert.equal(k({ status: 403 }), 'key');
assert.equal(k({ network: true }), 'network'); assert.equal(k(new TypeError('fetch failed')), 'network');
assert.equal(k({ status: 502 }), 'generic'); assert.equal(k({ status: 401 }), 'generic'); assert.equal(k(null), 'generic'); assert.equal(k({}), 'generic');
console.log('voice OK');
