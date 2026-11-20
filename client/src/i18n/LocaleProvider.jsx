import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './catalogs/en.js';
import ta from './catalogs/ta.js';
import { translateMessage } from './translate.js';

const LocaleContext = createContext(null);
const warnedMissingKeys = new Set();

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => localStorage.getItem('nammakkal-language') === 'ta' ? 'ta' : 'en');
  const setLocale = useCallback((nextLocale) => {
    const next = nextLocale === 'ta' ? 'ta' : 'en';
    localStorage.setItem('nammakkal-language', next);
    document.documentElement.lang = next;
    setLocaleState(next);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({
    locale,
    setLocale,
    t(key, values = {}) {
      return translateMessage(locale === 'ta' ? ta : en, en, locale, key, values, (missingKey, missingLocale) => {
        if (!import.meta.env.DEV) return;
        const warningKey = `${missingLocale}:${missingKey}`;
        if (warnedMissingKeys.has(warningKey)) return;
        warnedMissingKeys.add(warningKey);
        console.warn(`[NamMakkal i18n] Missing translation "${missingKey}" in the ${missingLocale} catalog.`);
      });
    }
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useTranslation must be used inside LocaleProvider');
  return context;
}
