import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { LANGUAGES, getLanguage, translate, detectLanguage } from '@/locales';
import { splitLangPath, switchLangUrl } from '@/lib/langPath';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/** Western digits -> Persian digits (used for Persian text only). */
export const toPersianDigits = (value) =>
  String(value ?? '').replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

const STORAGE_KEY = 'judge_lang';
const LanguageContext = createContext(null);

// The language is the first part of the address (/de/…). Without it (old links, "/"), the saved choice or the browser's language.
const readInitial = () => {
  const fromUrl = splitLangPath(window.location.pathname).lang;
  if (fromUrl) return fromUrl;
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  return detectLanguage(saved, typeof navigator !== 'undefined' ? [...(navigator.languages || []), navigator.language] : []);
};

/**
 * Language of the app. All texts live in src/locales/<code>.js (see src/locales/index.js to add a language).
 * useLang() gives { lang, dir, isFa, setLang, t(key, params), n(number), formatDate(date), languages }.
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readInitial);
  const info = getLanguage(lang);

  // Keep <html lang/dir> in sync (drives fonts and right-to-left layout)
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = info.dir;
  }, [lang, info.dir]);

  // Switching language = the same page under the other language's address (no page reload)
  const setLang = useCallback((code) => {
    const next = getLanguage(code).code;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    const { pathname, search, hash } = window.location;
    window.history.pushState(null, '', switchLangUrl(next, { pathname, search, hash }));
    setLangState(next);
  }, []);

  // The browser's back/forward buttons can change the language part of the address
  useEffect(() => {
    const onPop = () => {
      const fromUrl = splitLangPath(window.location.pathname).lang;
      if (fromUrl) setLangState(fromUrl);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const value = useMemo(() => {
    const isFa = lang === 'fa';
    const t = (key, params) => translate(lang, key, params);
    // n(): localise digits in a number or string (Persian digits when the UI is Persian)
    const n = (x) => (isFa ? toPersianDigits(x) : String(x ?? ''));
    const formatDate = (d) =>
      new Date(d).toLocaleDateString(info.locale, { month: 'short', day: 'numeric', year: 'numeric' });
    return { lang, isFa, dir: info.dir, setLang, t, n, formatDate, languages: LANGUAGES };
  }, [lang, info, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
