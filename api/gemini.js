/**
 * Vercel serverless function: keeps the Gemini API key on the server AND makes sure only people who have a credit
 * can use it.
 *
 * Request body: { model, body, kind, ticket }
 *   kind 'judge' (default): needs `ticket` from /api/credits {action:'spend'} (one credit = one analysis).
 *                           A ticket allows at most MAX_OK_CALLS successful answers.
 *   kind 'stt'            : voice -> text while writing a case; free, but needs an account and a daily cap.
 * Header: Authorization: Bearer <account key>
 *
 * Set on Vercel (Settings → Environment Variables):
 *   GEMINI_API_KEY       your Gemini key — no VITE_ prefix, so it never reaches the browser
 *   FALLBACK_API_KEY     (optional) backup AI (Groq / xAI Grok) used when Gemini cannot answer: see _lib/fallback.js
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (required)  see _lib/redis.js
 *   ALLOWED_ORIGINS      (optional)  comma-separated extra origins, e.g. https://localhost (Android app)
 *   GEMINI_ALLOWED_MODELS(optional)  comma-separated model allow-list
 *   STT_PER_DAY          (optional)  voice transcriptions per account per day (default 60)
 */
import { cmd } from './_lib/redis.js';
import { guard, body as readBody, today } from './_lib/http.js';
import { authUser } from './_lib/auth.js';
import { fallbackConfigured, shouldFallback, runFallback } from './_lib/fallback.js';

const ALLOWED_MODELS = (process.env.GEMINI_ALLOWED_MODELS || 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.5-flash,gemini-2.5-flash,gemini-2.5-flash-lite')
  .split(',').map((s) => s.trim()).filter(Boolean);

const MAX_OK_CALLS = 2;
const TICKET_TTL_SECONDS = 900;
const STT_PER_DAY = Number(process.env.STT_PER_DAY || 60);

export default async function handler(req, res) {
  if (guard(req, res)) return;

  const env = process.env;
  const key = env.GEMINI_API_KEY;
  if (!key && !fallbackConfigured(env)) return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });

  try {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_ACCOUNT' });

    const { model, body, kind, ticket } = readBody(req);
    if (!ALLOWED_MODELS.includes(model)) return res.status(400).json({ error: 'Model not allowed' });
    if (!body || typeof body !== 'object' || !Array.isArray(body.contents)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    let ticketKey = null;
    if (kind === 'stt') {
      const k = `stt:${user.uid}:${today()}`;
      const n = await cmd('INCR', k);
      if (n === 1) await cmd('EXPIRE', k, 172800);
      if (n > STT_PER_DAY) return res.status(429).json({ error: 'DAILY_LIMIT' });
    } else {
      if (!/^[a-f0-9]{32}$/.test(String(ticket || ''))) return res.status(402).json({ error: 'NO_TICKET' });
      if ((await cmd('GET', `t:${ticket}`)) !== user.uid) return res.status(402).json({ error: 'INVALID_TICKET' });
      if ((Number(await cmd('GET', `tc:${ticket}`)) || 0) >= MAX_OK_CALLS) return res.status(409).json({ error: 'TICKET_USED' });
      ticketKey = `tc:${ticket}`;
    }

    // 1) Gemini (unless the backup is set as primary)
    let out = null;
    if (key && env.AI_PRIMARY !== 'fallback') {
      try {
        const upstream = await fetch(
          `${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) }
        );
        out = { status: upstream.status, text: await upstream.text() };
      } catch (e) {
        console.warn('gemini unreachable:', e.message);
      }
    }
    // 2) backup provider when Gemini could not answer (quota, key, region, outage)
    if ((!out || (out.status >= 300 && shouldFallback(out.status, out.text))) && fallbackConfigured(env)) {
      try {
        const alt = await runFallback(env, body);
        if (alt) out = alt;
      } catch (e) {
        console.warn('fallback failed:', e.message);
      }
    }
    if (!out) return res.status(502).json({ error: 'Could not reach the AI' });

    if (out.status >= 200 && out.status < 300 && ticketKey) {
      // Remember that the AI really answered, so this credit can no longer be refunded
      await cmd('INCR', ticketKey);
      await cmd('EXPIRE', ticketKey, TICKET_TTL_SECONDS);
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(out.status).send(out.text);
  } catch (e) {
    console.error('gemini proxy error:', e);
    return res.status(502).json({ error: 'Could not reach Gemini' });
  }
}
