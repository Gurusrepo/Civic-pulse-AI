import { useEffect } from 'react';
import { getPreferences } from '../api/auth.js';
import { useAuth } from './AuthContext.jsx';
import { useTranslation } from '../i18n/LocaleProvider.jsx';
import { applyGlobalPreferences } from '../utils/applyPreferences.js';

export default function CitizenPreferencesSync() {
  const { user } = useAuth();
  const { setLocale } = useTranslation();

  useEffect(() => {
    if (!user?.id || user.role !== 'CITIZEN') return undefined;
    let active = true;
    getPreferences().then((preferences) => {
      if (!active) return;
      setLocale(preferences.language);
      applyGlobalPreferences(preferences);
    }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, user?.role, setLocale]);

  return null;
}
