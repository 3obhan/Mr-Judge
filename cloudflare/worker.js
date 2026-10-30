/**
 * Cloudflare Worker entry: serves the whole site.
 *   /api/*      -> the API (same files as on Vercel, via cloudflare/adapter.js)
 *   everything else is a static file from dist/ (served by Cloudflare before this code runs). Only addresses that are NOT
 *   files arrive here: they are the app's pages (/de/Credits ...), answered with that language's index.html.
 */
import { handleApi } from './adapter.js';
export { Store } from './store-do.js';

const LANG = /^\/(en|fa|ar|tr|de|fr|es|ru)(\/|$)/; // keep in sync with src/locales/index.js (a test checks it)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);

    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    if (/\.[A-Za-z0-9]{1,8}$/.test(url.pathname)) return new Response('Not found', { status: 404 }); // a missing file, not a page
    const m = LANG.exec(url.pathname);
    return env.ASSETS.fetch(new Request(new URL(m ? `/${m[1]}/` : '/', url), request));
  },
};
