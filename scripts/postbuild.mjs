/**
 * Runs after `vite build` (see package.json "build"). Gives every language its own real page so search engines and
 * link previews see the right language:
 *   dist/en/index.html, dist/de/index.html, ... with <html lang dir>, a translated <title> and description,
 * and, if VITE_SITE_URL is set (e.g. https://yourdomain.com), canonical + hreflang links, sitemap.xml and robots.txt.
 * The root dist/index.html stays as the entry that sends visitors to their language.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.DIST_DIR || path.join(root, 'dist');
const site = String(process.env.VITE_SITE_URL || '').replace(/\/$/, '');
const { LANGUAGES } = await import(new URL('../src/locales/index.js', import.meta.url));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const source = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!/<html[^>]*>/.test(source) || !/<title>[\s\S]*?<\/title>/.test(source)) throw new Error('dist/index.html has no <html> or <title>');

const alternates = site
  ? LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${site}/${l.code}/" />`).join('\n    ')
    + `\n    <link rel="alternate" hreflang="x-default" href="${site}/en/" />`
  : '';

for (const l of LANGUAGES) {
  const title = `${l.dict['logo.name']} – ${l.dict['home.tagline']}`;
  const description = l.dict['home.tagline'];
  const head = [
    `<meta name="description" content="${esc(description)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    site ? `<link rel="canonical" href="${site}/${l.code}/" />` : '',
    alternates,
  ].filter(Boolean).join('\n    ');
  const html = source
    .replace(/<html[^>]*>/, `<html lang="${l.code}" dir="${l.dir}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>\n    ${head}`);
  fs.mkdirSync(path.join(dist, l.code), { recursive: true });
  fs.writeFileSync(path.join(dist, l.code, 'index.html'), html);
}

// Plain links to every language in the root page, for crawlers and visitors without JavaScript
const links = LANGUAGES.map((l) => `<a href="/${l.code}/">${esc(l.name)}</a>`).join(' · ');
fs.writeFileSync(path.join(dist, 'index.html'), source.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><p style="text-align:center;font-family:sans-serif;padding:2rem">${links}</p></noscript>`));

if (site) {
  const urls = LANGUAGES.map((l) => `  <url>\n    <loc>${site}/${l.code}/</loc>\n${
    LANGUAGES.map((o) => `    <xhtml:link rel="alternate" hreflang="${o.code}" href="${site}/${o.code}/" />`).join('\n')}\n  </url>`).join('\n');
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
}
console.log(`postbuild: ${LANGUAGES.length} language pages${site ? ', sitemap.xml, robots.txt' : ' (set VITE_SITE_URL for canonical/hreflang/sitemap)'}`);
