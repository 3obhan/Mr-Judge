// The post-build step: one real page per language, sitemap, robots.txt.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Mr Judge</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n';
const run = (env) => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/postbuild.mjs')], { env: { ...process.env, DIST_DIR: dist, ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return dist;
};

let dist = run({ VITE_SITE_URL: '' });
for (const [code, dir] of [['en', 'ltr'], ['fa', 'rtl'], ['ar', 'rtl'], ['tr', 'ltr'], ['de', 'ltr'], ['fr', 'ltr'], ['es', 'ltr'], ['ru', 'ltr']]) {
  const page = fs.readFileSync(path.join(dist, code, 'index.html'), 'utf8');
  assert.match(page, new RegExp(`<html lang="${code}" dir="${dir}">`), `${code}: lang and dir`);
  assert.match(page, /<meta name="description" content="[^"]{10,}"/, `${code}: description`);
  assert.ok(!page.includes('hreflang'), 'no hreflang without a site address');
}
assert.match(fs.readFileSync(path.join(dist, 'de/index.html'), 'utf8'), /<title>Herr Richter – Streitigkeiten mit intelligenter/, 'German title');
assert.match(fs.readFileSync(path.join(dist, 'fa/index.html'), 'utf8'), /<title>آقای داور – /, 'Persian title (the brand name of the Persian locale)');
assert.ok(!fs.existsSync(path.join(dist, 'sitemap.xml')));
assert.match(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'), /<noscript>[\s\S]*href="\/de\/">Deutsch<\/a>/, 'root page links every language');

dist = run({ VITE_SITE_URL: 'https://example.com/' });
const de = fs.readFileSync(path.join(dist, 'de/index.html'), 'utf8');
assert.match(de, /<link rel="canonical" href="https:\/\/example\.com\/de\/" \/>/);
assert.match(de, /hreflang="fa" href="https:\/\/example\.com\/fa\/"/); assert.match(de, /hreflang="x-default" href="https:\/\/example\.com\/en\/"/);
const sm = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8'); assert.equal((sm.match(/<url>/g) || []).length, 8); assert.match(sm, /<loc>https:\/\/example\.com\/ru\/<\/loc>/);
assert.match(fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example\.com\/sitemap\.xml/);
console.log('postbuild OK');
