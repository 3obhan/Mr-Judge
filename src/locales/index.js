/**
 * The languages of the app. To ADD a language:
 *   1. copy en.js to xx.js and translate the values (keep the keys and the {placeholders});
 *   2. import it below and add one line to LANGUAGES.
 * Any text missing from a language falls back to English, and `npm test` fails if a language has missing or extra keys.
 */
import en from './en.js';
import fa from './fa.js';
import ar from './ar.js';
import tr from './tr.js';
import de from './de.js';
import fr from './fr.js';
import es from './es.js';
import ru from './ru.js';

/** code = BCP-47 language code, name = how the language calls itself, aiName = how to tell the AI which language to write in. */
export const LANGUAGES = [
  { code: 'en', name: 'English', aiName: 'English', dir: 'ltr', dict: en, locale: 'en-US' },
  { code: 'fa', name: 'فارسی', aiName: 'Persian (Farsi)', dir: 'rtl', dict: fa, locale: 'fa-IR-u-ca-gregory' },
  { code: 'ar', name: 'العربية', aiName: 'Arabic', dir: 'rtl', dict: ar, locale: 'ar' },
  { code: 'tr', name: 'Türkçe', aiName: 'Turkish', dir: 'ltr', dict: tr, locale: 'tr-TR' },
  { code: 'de', name: 'Deutsch', aiName: 'German', dir: 'ltr', dict: de, locale: 'de-DE' },
  { code: 'fr', name: 'Français', aiName: 'French', dir: 'ltr', dict: fr, locale: 'fr-FR' },
  { code: 'es', name: 'Español', aiName: 'Spanish', dir: 'ltr', dict: es, locale: 'es-ES' },
  { code: 'ru', name: 'Русский', aiName: 'Russian', dir: 'ltr', dict: ru, locale: 'ru-RU' },
];

const BY_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));
export const isSupported = (code) => code in BY_CODE;
export const getLanguage = (code) => BY_CODE[code] || BY_CODE.en;

/** Text for `key` in `code`, falling back to English, then to the key itself. {name} placeholders are filled from `params`. */
export function translate(code, key, params) {
  let text = getLanguage(code).dict[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

/** The language to start with: the saved choice, else the browser's language, else English. */
export function detectLanguage(saved, browserLanguages = []) {
  if (saved && isSupported(saved)) return saved;
  for (const l of browserLanguages) {
    const base = String(l || '').toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return 'en';
}
