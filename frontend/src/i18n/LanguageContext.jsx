// Language state: English / Hindi / Marathi.
// Persisted in localStorage so the choice survives page changes and reloads.
import { createContext, useContext, useEffect, useState } from 'react';
import { LANGUAGES, translations } from './translations';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'agriworks_lang';

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'hi' || saved === 'mr' ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Central t(): English text in, translated text out.
  // Falls back to English when a translation entry is missing.
  function t(text) {
    if (text === null || text === undefined) return text;
    const key = String(text);
    return translations[lang]?.[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
