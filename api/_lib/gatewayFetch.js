/**
 * fetch() for the calls to the Iranian payment gateway (Zibal), optionally through a STATIC-IP HTTP proxy such as Fixie
 * (usefixie.com). Vercel and Cloudflare have no fixed outbound IP, but the gateway only accepts the IPs you registered in
 * its panel; with a static-IP proxy the gateway always sees the proxy's IPs (Fixie shows them in its dashboard): register those.
 *
 * Setup: put the proxy address in the variable FIXIE_URL (or GATEWAY_PROXY_URL):  http://user:password@host:port
 * Only the gateway calls use it (not Stripe, Gemini, ...). Without the variable it is a normal fetch.
 * Works on Node (Vercel). Cloudflare Workers cannot use an HTTP proxy: there, use your own relay (relay/payment-relay.mjs).
 * Tested in tests/gatewayfetch.test.mjs (HTTPS through a CONNECT tunnel, wrong proxy password, plain HTTP, errors).
 */
const IN_WORKERS = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
const TIMEOUT_MS = 15000;
// Module names are built at run time so bundlers (Cloudflare's wrangler) do not try to bundle them: this only runs on Node
const nodeModule = async (name) => (await import(/* @vite-ignore */ `node:${name}`)).default;

export const proxyUrlFromEnv = () => {
  const u = String(process.env.FIXIE_URL || process.env.GATEWAY_PROXY_URL || '').trim();
  return /^https?:\/\/[^/]+/i.test(u) ? u : '';
};

export async function gatewayFetch(url, init = {}, { proxyUrl = proxyUrlFromEnv(), tlsOptions } = {}) {
  if (!proxyUrl || IN_WORKERS) return fetch(url, init);
  return fetchViaProxy(url, init, proxyUrl, tlsOptions);
}

export async function fetchViaProxy(url, init, proxyUrl, tlsOptions = {}) {
  const [http, https, tls] = await Promise.all([nodeModule('http'), nodeModule('https'), nodeModule('tls')]);
  const target = new URL(url);
  const proxy = new URL(proxyUrl);
  const proxyAuth = proxy.username
    ? `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString('base64')}`
    : '';
  const method = String(init.method || 'GET').toUpperCase();
  const body = init.body == null ? null : Buffer.from(init.body);
  const headers = { ...(init.headers || {}) };
  if (body) headers['Content-Length'] = String(body.length);

  let requester; let options;
  if (target.protocol === 'https:') {
    // HTTPS: ask the proxy for a tunnel (CONNECT) to the gateway, then talk TLS through it
    const hostPort = `${target.hostname}:${target.port || 443}`;
    const socket = await new Promise((resolve, reject) => {
      const c = http.request({
        host: proxy.hostname, port: Number(proxy.port) || 80, method: 'CONNECT', path: hostPort,
        headers: { Host: hostPort, ...(proxyAuth ? { 'Proxy-Authorization': proxyAuth } : {}) },
      });
      c.setTimeout(TIMEOUT_MS, () => c.destroy(new Error('Proxy timeout')));
      c.on('connect', (res, sock) => {
        if (res.statusCode === 200) resolve(sock);
        else { sock.destroy(); reject(Object.assign(new Error(`The proxy refused the connection (${res.statusCode})`), { proxyStatus: res.statusCode })); }
      });
      c.on('error', reject);
      c.end();
    });
    requester = https;
    // an agent whose connection is "TLS over the tunnel" (the request itself then looks like a normal HTTPS request)
    const agent = new https.Agent({ keepAlive: false });
    agent.createConnection = () => tls.connect({ socket, servername: target.hostname, ...tlsOptions });
    options = { method, host: target.hostname, port: Number(target.port) || 443, path: `${target.pathname}${target.search}`, headers, agent };
  } else {
    // plain HTTP: the proxy is given the full address
    requester = http;
    options = { method, host: proxy.hostname, port: Number(proxy.port) || 80, path: url, agent: false,
      headers: { ...headers, Host: target.host, ...(proxyAuth ? { 'Proxy-Authorization': proxyAuth } : {}) } };
  }

  return new Promise((resolve, reject) => {
    const req = requester.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('end', () => {
        const h = new Headers();
        for (const [k, v] of Object.entries(res.headers)) h.append(k, Array.isArray(v) ? v.join(', ') : String(v));
        resolve(new Response([204, 205, 304].includes(res.statusCode) ? null : Buffer.concat(chunks), { status: res.statusCode, headers: h }));
      });
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
