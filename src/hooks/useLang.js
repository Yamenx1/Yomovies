// ---------------------------------------------------------------------------
// useLang — UI language ('en' | 'ar'), persisted per browser.
// Applies <html> lang/dir and the TMDB response language as a side effect.
// Shared by every page so the choice survives route changes.
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from 'react';
import { STRINGS } from '../config/strings';
import { setTmdbLang } from '../services/tmdb';

export function useLang() {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('yo-lang') === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });
  const str = STRINGS[lang] ?? STRINGS.en;

  useEffect(() => {
    try {
      localStorage.setItem('yo-lang', lang);
    } catch {}
    document.documentElement.lang = lang;
    document.documentElement.dir = str.dir;
    setTmdbLang(lang === 'ar' ? 'ar-SA' : 'en-US');
  }, [lang, str.dir]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  return { lang, str, toggleLang };
}
