/**
 * Which message to show when voice-to-text fails. Returns a key of voice.* in src/locales
 * (unsupported / mic / noMic / tooShort / noSpeech / quota / key / server / network / generic / noDatabase / noAiKey / tooLong).
 * `err` comes from lib/geminiClient.js (status, apiError = our server's error code, detail, network).
 * Pure function, tested in tests/voice.test.mjs.
 */
export function voiceErrorKey(err) {
  const status = err?.status;
  const api = String(err?.apiError || '');
  const detail = String(err?.detail || err?.message || '');

  if (err?.network || err instanceof TypeError) return 'network';
  if (status === 429) return 'quota';
  if (status === 413) return 'tooLong';
  if (api === 'ACCOUNTS_NOT_CONFIGURED' || api === 'SERVER_ERROR' || status === 503) return 'noDatabase'; // the server's database is missing or broken
  if (status === 500 && /GEMINI_API_KEY/.test(`${api} ${detail}`)) return 'noAiKey';
  if (status === 404 || status === 405) return 'server'; // the /api/gemini function is not deployed
  if (/api key not valid|API_KEY_INVALID|referer|referrer/i.test(detail) || status === 403) return 'key'; // Google refuses the key
  return 'generic'; // includes 401 after the automatic fresh-account retry, and 502 (AI unreachable)
}
