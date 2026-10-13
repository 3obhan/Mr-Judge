import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'mrjudge_language';

const readStoredLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'fa' || stored === 'en' ? stored : 'en';
  } catch {
    // localStorage unavailable (private browsing, etc.) - fall back to 'en'
    // and just don't persist the choice across reloads.
    return 'en';
  }
};

/**
 * Provides one shared `language` value ('en' | 'fa') for the whole app,
 * persisted to localStorage. Before this, language lived only inside
 * DisputeForm's local state, which is why Home, the site header, and the
 * various loading states never reflected the language the person picked -
 * they simply had no way to know about it.
 */
export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not persisted this session, but the app still works.
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
