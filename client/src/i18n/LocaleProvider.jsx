import { createContext, useContext, useMemo } from 'react';
import en from './catalogs/en.js';

const LocaleContext = createContext(null);

function resolveMessage(catalog, key) {
  return key.split('.').reduce((value, part) => value?.[part], catalog);
}

export function LocaleProvider({ children }) {
  const value = useMemo(() => ({
    locale: 'en',
    t(key, values = {}) {
      const message = resolveMessage(en, key);
      if (typeof message !== 'string') return key;
      return message.replace(/\{(\w+)\}/g, (match, name) => (
        Object.hasOwn(values, name) ? String(values[name]) : match
      ));
    }
  }), []);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useTranslation must be used inside LocaleProvider');
  return context;
}
