/**
 * Runs the same API files that Vercel runs (api/*.js, written as (req, res) handlers) inside a Cloudflare Worker:
 * it turns the Worker's Request into a small req object, collects what the handler writes to res, and returns a Response.
 */
const HANDLERS = {
  account: () => import('../api/account.js'),
  bazaar: () => import('../api/bazaar.js'),
  config: () => import('../api/config.js'),
  credits: () => import('../api/credits.js'),
  email: () => import('../api/email.js'),
  gemini: () => import('../api/gemini.js'),
  paypal: () => import('../api/paypal.js'),
  stripe: () => import('../api/stripe.js'),
  'stripe-webhook': () => import('../api/stripe-webhook.js'),
  zarinpal: () => import('../api/zarinpal.js'),
};

const jsonResponse = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const load = Object.prototype.hasOwnProperty.call(HANDLERS, name) ? HANDLERS[name] : null;
  if (!load) return jsonResponse({ error: 'Not found' }, 404);

  // The handlers read settings from process.env (as on Vercel): copy the Worker's variables and secrets there
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v;
  if (env.STORE) globalThis.__REDIS_DO = env.STORE; // the built-in database (Durable Object)

  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const rawBody = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  let body = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }
  const req = { method: request.method, headers, body, rawBody, url: url.pathname + url.search };

  const out = { status: 200, headers: new Headers(), body: '' };
  const res = {
    status(code) { out.status = code; return this; },
    setHeader(k, v) { out.headers.set(k, String(v)); },
    json(obj) { out.headers.set('Content-Type', 'application/json'); out.body = JSON.stringify(obj); return this; },
    send(text) { out.body = typeof text === 'string' ? text : JSON.stringify(text); return this; },
    end() { return this; },
  };

  try {
    const mod = await load();
    await mod.default(req, res);
  } catch (e) {
    console.error(`api/${name} crashed:`, e);
    return jsonResponse({ error: 'SERVER_ERROR' }, 500);
  }
  return new Response(out.status === 204 || out.status === 304 ? null : out.body, { status: out.status, headers: out.headers });
}
