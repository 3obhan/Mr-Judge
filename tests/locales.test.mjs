// Every language must have exactly the same texts as English, and every text the app asks for must exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { LANGUAGES, translate, detectLanguage, getLanguage, isSupported } = await import(new URL('../src/locales/index.js', import.meta.url));
const en = LANGUAGES.find((l) => l.code === 'en').dict;
const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join();

assert.equal(LANGUAGES.length, 8);
for (const l of LANGUAGES) {
  assert.deepEqual(Object.keys(l.dict).sort(), Object.keys(en).sort(), `${l.code}: same keys as English`);
  for (const [k, v] of Object.entries(l.dict)) {
    assert.ok(typeof v === 'string' && v.trim(), `${l.code}.${k} is empty`);
    assert.equal(ph(v), ph(en[k]), `${l.code}.${k}: {placeholders} must match English`);
  }
  assert.ok(['ltr', 'rtl'].includes(l.dir) && l.name && l.aiName && l.locale);
}
assert.deepEqual(LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code), ['fa', 'ar']);
for (const code of ['de', 'fr', 'es', 'ru', 'tr', 'ar']) assert.notEqual(LANGUAGES.find((l) => l.code === code).dict['form.submit'], en['form.submit'], `${code} is really translated`);

// every key the code uses exists in English (literal keys; the dynamic form./voice./pdf./judge. ones are listed below)
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'locales') walk(p); } else if (/\.(jsx?|ts)$/.test(f)) files.push(p); } })(path.join(root, 'src'));
const NS = 'tab|common|home|new|results|history|credits|settings|email|nf|logo|lang|form|voice|verdict|gauge|judge|pdf';
const used = new Set();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(new RegExp(`['"](?:${NS})\\.[A-Za-z0-9.]+['"]`, 'g'))) used.add(m[0].slice(1, -1));
for (const k of ['A', 'B', 'BOTH', 'NEITHER']) used.add(`judge.${k}`);
for (const k of ['title', 'subtitle', 'personA', 'personB', 'placeholderA', 'placeholderB', 'submit', 'voiceHint', 'analyzing']) used.add(`form.${k}`);
for (const k of ['unsupported', 'mic', 'noMic', 'tooShort', 'noSpeech', 'quota', 'key', 'server', 'network', 'generic']) used.add(`voice.${k}`);
for (const k of ['title', 'verdict', 'analysis', 'personA', 'personB', 'statement', 'statementsSection', 'certified', 'date', 'mrJudge', 'score']) used.add(`pdf.${k}`);
const unknown = [...used].filter((k) => !(k in en));
assert.deepEqual(unknown, [], `texts used in the code but missing from en.js: ${unknown}`);

// helpers
assert.equal(translate('de', 'credits.offer', { n: 5, price: '$1.00' }), 'Erhalte 5 Streitanalysen für nur $1.00');
assert.equal(translate('xx', 'common.back'), 'Back', 'unknown language -> English');
assert.equal(translate('de', 'no.such.key'), 'no.such.key', 'unknown key -> the key');
assert.equal(detectLanguage('fr', ['de']), 'fr'); assert.equal(detectLanguage(null, ['pt-BR', 'de-AT', 'en']), 'de');
assert.equal(detectLanguage('xx', ['ru-RU']), 'ru'); assert.equal(detectLanguage(null, ['ja']), 'en'); assert.equal(detectLanguage(null, []), 'en');
assert.equal(getLanguage('xx').code, 'en'); assert.equal(isSupported('ar'), true); assert.equal(isSupported('ja'), false);
console.log(`locales OK (${LANGUAGES.length} languages, ${Object.keys(en).length} texts, ${used.size} used keys checked)`);
