import { isSupported } from '@/locales';

/**
 * Every language has its own address:  https://site/de/…  https://site/fa/…  (the first part of the path is the language).
 * These helpers are pure so they can be tested.
 */

/** "/de/Credits" -> { lang: 'de', rest: '/Credits' };  "/Credits" -> { lang: null, rest: '/Credits' } */
export function splitLangPath(pathname) {
  const m = /^\/([A-Za-z]{2})(\/.*)?$/.exec(pathname || '/');
  if (m && isSupported(m[1].toLowerCase())) return { lang: m[1].toLowerCase(), rest: m[2] || '/' };
  return { lang: null, rest: pathname || '/' };
}

/** withLang('de', '/Credits') -> '/de/Credits';  withLang('de', '/') -> '/de/' */
export function withLang(lang, rest = '/') {
  return `/${lang}${rest.startsWith('/') ? rest : `/${rest}`}`;
}

/** Same page in another language, keeping query and hash. */
export function switchLangUrl(code, { pathname, search = '', hash = '' }) {
  return `${withLang(code, splitLangPath(pathname).rest)}${search}${hash}`;
}
