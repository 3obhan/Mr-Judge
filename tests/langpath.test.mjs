// Per-language addresses: /de/Credits etc.
import { register } from 'node:module';
import assert from 'node:assert/strict';
register('./loader.mjs', import.meta.url);
const { splitLangPath, withLang, switchLangUrl } = await import(new URL('../src/lib/langPath.js', import.meta.url));

assert.deepEqual(splitLangPath('/de/Credits'), { lang: 'de', rest: '/Credits' });
assert.deepEqual(splitLangPath('/de/'), { lang: 'de', rest: '/' });
assert.deepEqual(splitLangPath('/de'), { lang: 'de', rest: '/' });
assert.deepEqual(splitLangPath('/FA/History'), { lang: 'fa', rest: '/History' }, 'upper case is fine');
assert.deepEqual(splitLangPath('/Credits'), { lang: null, rest: '/Credits' });
assert.deepEqual(splitLangPath('/'), { lang: null, rest: '/' });
assert.deepEqual(splitLangPath('/xx/Credits'), { lang: null, rest: '/xx/Credits' }, 'unknown language code is not a language');
assert.deepEqual(splitLangPath('/dex/Credits'), { lang: null, rest: '/dex/Credits' });
assert.deepEqual(splitLangPath('/api/gemini'), { lang: null, rest: '/api/gemini' });
assert.equal(withLang('fr', '/'), '/fr/'); assert.equal(withLang('fr', '/Credits'), '/fr/Credits'); assert.equal(withLang('fr', 'Credits'), '/fr/Credits');
assert.equal(switchLangUrl('ru', { pathname: '/de/Results', search: '?id=5', hash: '' }), '/ru/Results?id=5');
assert.equal(switchLangUrl('ar', { pathname: '/fa/', search: '', hash: '#x' }), '/ar/#x');
assert.equal(switchLangUrl('en', { pathname: '/Credits', search: '', hash: '' }), '/en/Credits', 'a page without language gets one');
console.log('langpath OK');
