// Lets Node run the app's own source files in tests: "@/..." imports and import.meta.env.
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return { url: pathToFileURL(path.join(root, 'tests/stub-cloudflare-workers.mjs')).href, shortCircuit: true };
  if (specifier === '@/lib/i18n') return { url: pathToFileURL(path.join(root, 'tests/stub-i18n.mjs')).href, shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const base = path.join(root, 'src', specifier.slice(2));
    const file = fs.existsSync(`${base}.js`) ? `${base}.js` : path.join(base, 'index.js'); // "@/locales" is a folder
    return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.includes('/src/') && url.endsWith('.js')) {
    const src = fs.readFileSync(fileURLToPath(url), 'utf8').replace(/import\.meta\.env/g, 'globalThis.__ENV');
    return { format: 'module', source: src, shortCircuit: true };
  }
  return next(url, context);
}
