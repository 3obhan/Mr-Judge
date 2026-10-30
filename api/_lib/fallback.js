/**
 * Backup AI provider: when Gemini cannot answer (free quota used up, key problem, region block, outage), the same
 * request is sent to Groq (groq.com: free tier, Llama + Whisper) or any OpenAI-compatible service such as xAI Grok.
 * The app always speaks "Gemini format"; this file translates a Gemini request into a chat-completion (or Whisper
 * transcription) request and the answer back into a Gemini-shaped response, so the app does not notice the switch.
 *
 * Settings (all optional except the key):
 *   FALLBACK_API_KEY      the backup service's key (secret)
 *   FALLBACK_BASE_URL     default https://api.groq.com/openai/v1   (xAI Grok: https://api.x.ai/v1)
 *   FALLBACK_MODEL        default llama-3.3-70b-versatile          (model names change: check the provider's list)
 *   FALLBACK_STT_MODEL    default whisper-large-v3-turbo           (voice -> text; Groq only)
 *   FALLBACK_STT=1        allow voice -> text on a non-Groq base URL that offers /audio/transcriptions
 *   AI_PRIMARY=fallback   use the backup FIRST (e.g. to save the Gemini quota); Gemini is then not used at all
 */
const DEFAULT_BASE = 'https://api.groq.com/openai/v1';

export const fallbackConfigured = (env) => !!env.FALLBACK_API_KEY;

const baseUrl = (env) => String(env.FALLBACK_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const sttSupported = (env) => /(^|\.)groq\.com$/i.test(hostOf(baseUrl(env))) || env.FALLBACK_STT === '1';

/** Should a failed Gemini answer be retried on the backup? (not for plain bad requests or retired models) */
export function shouldFallback(status, text) {
  if (status === 429 || status === 401 || status === 403 || status >= 500) return true;
  return status === 400 && /location is not supported/i.test(String(text || ''));
}

const partsOf = (body) => (body?.contents || []).flatMap((c) => c?.parts || []);
const textOf = (body) => partsOf(body).map((p) => p.text).filter(Boolean).join('\n\n');
const audioOf = (body) => partsOf(body).find((p) => p.inlineData?.data && /^audio\//i.test(p.inlineData.mimeType || ''));

const asGemini = (text) => JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });

function describeSchema(schema) {
  const props = schema?.properties || {};
  const lines = Object.entries(props).map(([k, v]) => `- "${k}" (${String(v?.type || 'string').toLowerCase()})${v?.description ? `: ${v.description}` : ''}`);
  return `Reply with ONLY a valid JSON object (no markdown, no extra text) with exactly these keys:\n${lines.join('\n')}`;
}

async function chat(env, body) {
  const schema = body?.generationConfig?.responseSchema;
  const text = textOf(body);
  const res = await fetch(`${baseUrl(env)}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.FALLBACK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.FALLBACK_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: schema ? `${text}\n\n${describeSchema(schema)}` : text }],
      temperature: 0.3,
      ...(schema ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) return null;
  const out = (await res.json().catch(() => null))?.choices?.[0]?.message?.content;
  return out ? { status: 200, text: asGemini(out) } : null;
}

const EXT = { wav: 'wav', wave: 'wav', mpeg: 'mp3', mp3: 'mp3', webm: 'webm', ogg: 'ogg', mp4: 'm4a', 'x-m4a': 'm4a', flac: 'flac' };

async function transcribe(env, body, audio) {
  if (!sttSupported(env)) return null;
  const sub = String(audio.inlineData.mimeType).split('/')[1]?.split(';')[0].toLowerCase();
  const bytes = Uint8Array.from(atob(audio.inlineData.data), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: audio.inlineData.mimeType }), `audio.${EXT[sub] || 'wav'}`);
  form.append('model', env.FALLBACK_STT_MODEL || 'whisper-large-v3-turbo');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  // the app's voice prompt starts with "Language code: xx" (ISO 639-1): it helps Whisper a lot
  const code = /Language code:\s*([a-z]{2,3})/i.exec(textOf(body))?.[1] || (/persian|farsi|فارسی/i.test(textOf(body)) ? 'fa' : '');
  if (code) form.append('language', code.toLowerCase());
  const res = await fetch(`${baseUrl(env)}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.FALLBACK_API_KEY}` },
    body: form,
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  return typeof j?.text === 'string' ? { status: 200, text: asGemini(JSON.stringify({ transcript: j.text.trim() })) } : null;
}

/** Answers a Gemini-format request with the backup provider. Returns { status, text } (Gemini-shaped) or null. */
export async function runFallback(env, body) {
  const audio = audioOf(body);
  return audio ? transcribe(env, body, audio) : chat(env, body);
}
