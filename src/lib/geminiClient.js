import { getAccountKey, ensureAccount, recreateAccount } from '@/lib/account';
import { getLanguage } from '@/locales';
import { GEMINI_API_KEY, GEMINI_PROXY_URL, GEMINI_MODE, GEMINI_MODELS, GEMINI_STT_MODELS } from '@/lib/llmConfig';

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Gemini wants an OpenAPI-style schema: upper-case types, no "description-only" extras issues.
const toGeminiSchema = (schema) => {
  if (!schema || typeof schema !== 'object') return schema;
  const out = { ...schema };
  if (typeof out.type === 'string') out.type = out.type.toUpperCase();
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (out.items) out.items = toGeminiSchema(out.items);
  return out;
};

const REQUEST_TIMEOUT_MS = 60_000;

async function generateOnce(body, model, kind, ticket) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    if (GEMINI_MODE === 'direct') {
      res = await fetch(ENDPOINT(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } else {
      // 'proxy' (another site) or 'server' (same site): the key stays on the server
      const send = () => fetch(`${GEMINI_PROXY_URL}/api/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccountKey()}` },
        body: JSON.stringify({ model, body, kind: kind === 'stt' ? 'stt' : 'judge', ticket }),
        signal: controller.signal,
      });
      res = await send();
      // The server does not know our account key (the database was replaced, or the account was deleted): start a new
      // account and try once more. (Credits of an account the server no longer has cannot be recovered anyway.)
      if (res.status === 401 && !ticket) {
        const peek = await res.clone().json().catch(() => ({}));
        if (peek?.error === 'INVALID_ACCOUNT') { await recreateAccount(); res = await send(); }
      }
    }
  } catch (e) {
    const timedOut = e?.name === 'AbortError';
    const err = new Error(timedOut ? 'The request took too long (timeout).' : 'Network error: could not reach the server.');
    err.network = true;
    err.code = 'NETWORK';
    err.detail = timedOut ? 'timeout' : 'network';
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let message = raw;
    let apiError = '';
    try {
      const j = JSON.parse(raw);
      message = j?.error?.message || (typeof j?.error === 'string' ? j.error : raw);
      if (typeof j?.error === 'string') apiError = j.error; // our own server's error code, e.g. ACCOUNTS_NOT_CONFIGURED
    } catch { /* keep raw text */ }
    const detail = `HTTP ${res.status}${message ? ` - ${String(message).replace(/\s+/g, ' ').slice(0, 180)}` : ''}`;
    const err = new Error(`Gemini request failed (${detail})`);
    err.status = res.status;
    err.detail = detail;
    err.apiError = apiError;
    throw err;
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

// Remember which model worked last, per purpose, so later calls do not retry the broken ones first.
const preferred = {};

// Should we try the next model? Yes when this one is gone / not available to the key / overloaded.
const shouldTryNext = (err) => {
  const status = err?.status;
  const detail = String(err?.detail || err?.message || '');
  if (/api key|referer|referrer|quota|billing/i.test(detail)) return false;
  if (/NOT_CONFIGURED/.test(detail)) return false; // a setup problem on the server: other models will not help
  if (status === 404 || status === 503) return true;
  if (status === 400 || status === 403) return /model|not found|no longer|deprecat|retired|access|unsupported/i.test(detail);
  return false;
};

// Temporary problems (network blip, rate limit, server hiccup): worth one or two quick retries on the SAME model.
const isTransient = (err) => {
  if (err?.network) return true;
  const detail = String(err?.detail || err?.message || '');
  if (/api key|referer|referrer|quota|billing|DAILY_LIMIT|NOT_CONFIGURED|GEMINI_API_KEY/i.test(detail)) return false; // (setup problems are not temporary)
  return [429, 500, 502, 504].includes(err?.status);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRIES = 2;

async function generateWithRetry(body, model, kind, ticket) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await generateOnce(body, model, kind, ticket);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === MAX_RETRIES) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function generate(body, models, kind, ticket) {
  const first = preferred[kind];
  const order = first ? [first, ...models.filter((m) => m !== first)] : models;
  let lastErr;
  for (const model of order) {
    try {
      const text = await generateWithRetry(body, model, kind, ticket);
      preferred[kind] = model;
      return text;
    } catch (err) {
      lastErr = err;
      if (!shouldTryNext(err)) throw err;
      console.warn(`Gemini model "${model}" failed (${err.detail || err.message}); trying the next one`);
    }
  }
  throw lastErr;
}

// Pull a JSON object out of a model reply, even if it is wrapped in code fences or has extra text around it.
const parseJsonLoose = (text) => {
  const cleaned = String(text).replace(/```json|```/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* try to find the object inside */ }
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a !== -1 && b > a) return JSON.parse(cleaned.slice(a, b + 1));
  throw new Error('Gemini returned an unreadable answer.');
};

/**
 * Generate content. Returns a parsed object if jsonSchema is given, otherwise a string.
 */
export async function callGemini(prompt, jsonSchema = null, { ticket } = {}) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  if (jsonSchema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(jsonSchema),
    };
  }
  const text = await generate(body, GEMINI_MODELS, 'judge', ticket);
  if (!jsonSchema) return text;
  return parseJsonLoose(text);
}

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not read audio.'));
    r.readAsDataURL(blob);
  });

const STT_PROMPTS = {
  fa: `Language code: fa.\nYou are a professional Persian (Farsi) speech-to-text engine. Transcribe the audio exactly as spoken.
Rules:
- Write in Persian script with standard Persian orthography: use ی and ک (never Arabic ي ك), and correct half-spaces (نیم‌فاصله) in words like می‌خواهم، نمی‌دانم، کتاب‌ها.
- Add natural punctuation (، . ؟ !) and split into sentences.
- Keep the speaker's own wording, including colloquial forms (e.g. "می‌خوام", "نمیدونم"), but spell them correctly. Do NOT rewrite, formalise, correct, summarise or translate.
- Keep foreign words, names and brands as spoken (in Latin letters if they are normally written that way).
- Write numbers with Persian digits (۰-۹).
- Ignore background noise, music and other voices that are clearly not the main speaker.
- Never add words that were not said. If there is no intelligible speech, return an empty transcript.`,
  en: `Language code: en.\nYou are a professional speech-to-text engine. Transcribe the audio exactly as spoken in English.
Rules:
- Use correct spelling, capitalisation and punctuation, and split into sentences.
- Keep the speaker's own wording. Do NOT rewrite, correct, summarise or translate. Remove only filler sounds like "um" and "uh".
- Keep names and brands as spoken. Write numbers as digits where natural.
- Ignore background noise, music and other voices that are clearly not the main speaker.
- Never add words that were not said. If there is no intelligible speech, return an empty transcript.`,
};

/** Any other language: the same rules as English, with the language named (and its code, which the backup Whisper uses). */
const sttPrompt = (code) => {
  if (STT_PROMPTS[code]) return STT_PROMPTS[code];
  const name = getLanguage(code).aiName;
  return STT_PROMPTS.en
    .replace('Language code: en.', `Language code: ${code}.`)
    .replace('as spoken in English', `as spoken in ${name}`)
    .replace('Use correct spelling, capitalisation and punctuation', `Use the correct spelling and punctuation of ${name}`);
};

const normalizeFa = (text) =>
  text.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();

/**
 * Speech-to-text with Gemini (replaces Base44 TranscribeAudio).
 * @param {Blob} blob - audio (WAV recommended, see preparePcm)
 * @param {{mimeType?: string, language?: string, context?: string}} opts  (language = code of any app language)
 *   context = text already typed in the box; helps with names/terms but is never repeated.
 * @returns {Promise<string>} transcript ('' if no speech was found)
 */
export async function transcribeAudio(blob, { mimeType = 'audio/wav', language = 'en', context = '' } = {}) {
  await ensureAccount(); // the voice endpoint needs an account
  const data = await blobToBase64(blob);
  const ctx = (context || '').trim().slice(-400);
  const prompt =
    sttPrompt(language) +
    (ctx ? `\n\nText the speaker already wrote (for spelling of names and terms ONLY, never repeat it in the transcript):\n"""${ctx}"""` : '');

  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: { transcript: { type: 'STRING', description: 'The verbatim transcript, or empty string if no speech.' } },
      required: ['transcript'],
    },
  };
  const text = await generate(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data } }] }],
      generationConfig,
    },
    GEMINI_STT_MODELS,
    'stt'
  );

  let transcript = '';
  try {
    transcript = parseJsonLoose(text).transcript || '';
  } catch {
    transcript = text; // model ignored the schema; use the raw text
  }
  transcript = transcript.trim();
  return language === 'fa' ? normalizeFa(transcript) : transcript.replace(/\s+/g, ' ');
}
