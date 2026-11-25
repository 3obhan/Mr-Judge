// The judge in several languages (prompt language, verdict wording, digits), with a fake Gemini.
import { register } from 'node:module';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.__ENV = { VITE_GEMINI_PROXY_URL: 'https://api.test/gemini' };
register('./loader.mjs', import.meta.url);
const calls = [];
let answer = { partyAScore: 80, partyBScore: 30, executiveSummary: 'In 3 Punkten hat A recht.' };
let failPrimary = 0; let failAll = 0;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('/api/account')) return new Response(JSON.stringify({ accountKey: 'AAAA-BBBB-CCCC-DDDD-EEEE', credits: 2 }), { status: 200 });
  const { model } = JSON.parse(init.body);
  const fail = failAll || (model === 'gemini-4-hydrogen' ? failPrimary : 0);
  if (fail) return new Response(JSON.stringify({ error: { message: fail === 429 ? 'You exceeded your current quota' : fail === 404 ? 'model not found' : 'Could not reach the AI' } }), { status: fail });
  const payload = answer;
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status: 200 });
};
const { judgeDispute } = await import(new URL('../src/lib/judge.js', import.meta.url));
const { translate } = await import(new URL('../src/locales/index.js', import.meta.url));
const promptOf = () => JSON.parse(calls.filter((call) => call.init?.body && String(call.url).includes('/api/gemini')).at(-1).init.body).body.contents[0].parts[0].text;
const bodyOf = () => JSON.parse(calls.filter((call) => call.init?.body && String(call.url).includes('/api/gemini')).at(-1).init.body).body;
const base = { personA_statement: 'a', personB_statement: 'b' };

for (const [code, aiName, verdictA] of [['en', 'English', 'Person A is more justified'], ['de', 'German', 'Person A hat eher recht'], ['fr', 'French', 'La personne A a davantage raison'],
  ['es', 'Spanish', 'La persona A tiene más razón'], ['ru', 'Russian', 'Сторона А права в большей степени'], ['tr', 'Turkish', 'A Kişisi daha haklı'], ['ar', 'Arabic', 'الحق مع الشخص أ بدرجة أكبر']]) {
  const before = calls.filter((call) => String(call.url).includes('/api/gemini')).length;
  const r = await judgeDispute({ ...base, language: code });
  assert.equal(calls.filter((call) => String(call.url).includes('/api/gemini')).length - before, 1, 'each paid judgment uses exactly one model call');
  assert.match(promptOf(), new RegExp(`Write every user-facing field in clear, natural ${aiName}\\.`), `${code}: the AI is told to write in ${aiName}`);
  assert.equal(r.verdict, verdictA, `${code}: verdict wording`); assert.equal(r.explanation, 'In 3 Punkten hat A recht.', `${code}: digits stay as they are`);
}
let r = await judgeDispute({ ...base, language: 'fa' });
assert.match(promptOf(), /تمام فیلدهای متنی خروجی را به فارسی روان/); assert.equal(r.verdict, 'شخص الف حق بیشتری دارد'); assert.equal(r.explanation, 'In ۳ Punkten hat A recht.', 'Persian digits only for Persian');
r = await judgeDispute({ ...base, language: 'xx' }); assert.match(promptOf(), /natural English\./, 'unknown language -> English'); assert.equal(r.verdict, 'Person A is more justified');
assert.match(bodyOf().systemInstruction.parts[0].text, /do NOT need to add up to 100/, 'the judicial axioms travel as the system instruction');
assert.match(r.decreeCode, /^MJ-[0-9A-Z]+$/); assert.equal(r.winner, 'partyA');
// each party is scored out of 100 on its own: the pair is kept as the judge gave it
for (const [a, b, winner, wording] of [[45, 90, 'partyB', 'Person B hat eher recht'], [85, 70, 'partyA', 'Person A hat eher recht'],
  [50, 50, 'equal', 'Beide Seiten haben teilweise recht'], [10, 10, 'equal', '']]) {
  answer = { partyAScore: a, partyBScore: b, executiveSummary: 'x' }; r = await judgeDispute({ ...base, language: 'de' });
  assert.deepEqual([r.personA_score, r.personB_score, r.winner], [a, b, winner]);
  assert.equal(r.verdict, a === 10 ? translate('de', 'judge.NEITHER') : wording);
}
answer = { partyAScore: 120, partyBScore: -5, executiveSummary: 'x' }; r = await judgeDispute({ ...base, language: 'en' });
assert.deepEqual([r.personA_score, r.personB_score], [100, 0], 'scores stay within 0 to 100');
// an unusable answer is an error (the credit is refunded), never an invented score
for (const bad of [{ executiveSummary: 'x' }, { partyAScore: 'high', partyBScore: 20, executiveSummary: 'x' }, { partyAScore: 60, executiveSummary: 'x' }, { partyAScore: 60, partyBScore: 20 }]) {
  answer = bad; await assert.rejects(() => judgeDispute({ ...base, language: 'en' }), /empty analysis/);
}
// models: Gemini 4 thinks at medium level; when it is out of quota or too slow the next model answers
answer = { partyAScore: 60, partyBScore: 40, executiveSummary: 'ok' };
const judged = () => calls.filter((call) => String(call.url).includes('/api/gemini')).map((call) => JSON.parse(call.init.body));
for (const status of [429, 502, 504, 404]) {
  calls.length = 0; failPrimary = status; r = await judgeDispute({ ...base, language: 'en' });
  const used = judged();
  assert.equal(used[0].model, 'gemini-4-hydrogen'); assert.equal(used[0].body.generationConfig.thinkingConfig.thinkingLevel, 'medium');
  assert.equal(used.at(-1).model, 'gemini-3.8-flash', `${status}: the fallback model answers`);
  assert.equal(used.at(-1).body.generationConfig.thinkingConfig, undefined, 'older models get no thinking setting');
  assert.equal(r.personA_score, 60);
}
calls.length = 0; failPrimary = 0; await judgeDispute({ ...base, language: 'en' });
assert.deepEqual(judged().map((c) => c.model), ['gemini-4-hydrogen'], 'the next judgment starts with the primary model again');
calls.length = 0; failAll = 502; await assert.rejects(() => judgeDispute({ ...base, language: 'en' }));
assert.ok(judged().length <= 8, `one ticket allows 8 attempts, used ${judged().length}`);
console.log('judge languages OK');
