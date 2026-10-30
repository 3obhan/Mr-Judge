// The judge in several languages (prompt language, verdict wording, digits), with a fake Gemini.
import { register } from 'node:module';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.__ENV = { VITE_GEMINI_PROXY_URL: 'https://api.test/gemini' };
register('./loader.mjs', import.meta.url);
const calls = [];
let answer = { personA_score: 80, personB_score: 30, explanation: 'In 3 Punkten hat A recht.' };
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('/api/account')) return new Response(JSON.stringify({ accountKey: 'AAAA-BBBB-CCCC-DDDD-EEEE', credits: 2 }), { status: 200 });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 });
};
const { judgeDispute } = await import(new URL('../src/lib/judge.js', import.meta.url));
const promptOf = () => JSON.parse(calls.at(-1).init.body).body.contents[0].parts[0].text;
const base = { personA_statement: 'a', personB_statement: 'b' };

for (const [code, aiName, verdictA] of [['en', 'English', 'Person A is more justified'], ['de', 'German', 'Person A hat eher recht'], ['fr', 'French', 'La personne A a davantage raison'],
  ['es', 'Spanish', 'La persona A tiene más razón'], ['ru', 'Russian', 'Сторона А права в большей степени'], ['tr', 'Turkish', 'A Kişisi daha haklı'], ['ar', 'Arabic', 'الحق مع الشخص أ بدرجة أكبر']]) {
  const r = await judgeDispute({ ...base, language: code });
  assert.match(promptOf(), new RegExp(`Write the explanation in clear, natural ${aiName}\\.`), `${code}: the AI is told to write in ${aiName}`);
  assert.equal(r.verdict, verdictA, `${code}: verdict wording`); assert.equal(r.explanation, 'In 3 Punkten hat A recht.', `${code}: digits stay as they are`);
}
let r = await judgeDispute({ ...base, language: 'fa' });
assert.match(promptOf(), /به فارسی روان/); assert.equal(r.verdict, 'شخص الف حق بیشتری دارد'); assert.equal(r.explanation, 'In ۳ Punkten hat A recht.', 'Persian digits only for Persian');
r = await judgeDispute({ ...base, language: 'xx' }); assert.match(promptOf(), /natural English\./, 'unknown language -> English'); assert.equal(r.verdict, 'Person A is more justified');
answer = { personA_score: 50, personB_score: 55, explanation: 'x' }; r = await judgeDispute({ ...base, language: 'de' }); assert.equal(r.verdict, 'Beide Seiten haben teilweise recht');
answer = { personA_score: 10, personB_score: 20, explanation: 'x' }; r = await judgeDispute({ ...base, language: 'ru' }); assert.equal(r.verdict, 'Ни одна из сторон не права');
console.log('judge languages OK');
