import { createContext, useContext, useEffect, useMemo } from 'react';
import fr from './locales/fr.js';
import { setDateLocale } from './api.js';

// tourneur.ch is in French only. The interface strings keep the English keys of
// the ART sur bois code base (shared components); src/locales/fr.js gives the text.
const LanguageContext = createContext(null);
const LOCALE = 'fr-CH';

export function translate(_language, text) {
  return fr[text] || text;
}

export function LanguageProvider({ children }) {
  setDateLocale(LOCALE);
  useEffect(() => { document.documentElement.lang = 'fr'; }, []);
  const value = useMemo(() => ({
    language: 'fr',
    locale: LOCALE,
    t: (text, variables = {}) => {
      let translated = fr[text] || text;
      Object.entries(variables).forEach(([key, replacement]) => {
        translated = translated.replaceAll(`{{${key}}}`, String(replacement));
      });
      return translated;
    },
  }), []);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
