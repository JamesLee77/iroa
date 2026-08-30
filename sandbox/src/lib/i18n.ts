import ko from '../locales/ko.json';
import en from '../locales/en.json';

export type Locale = 'ko' | 'en';
export type TranslationKey = keyof typeof ko;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { ko, en };

export function getInitialLocale(): Locale {
  const stored = window.localStorage.getItem('iroa-sandbox-locale');
  if (stored === 'ko' || stored === 'en') return stored;
  return window.navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function setStoredLocale(locale: Locale): void {
  window.localStorage.setItem('iroa-sandbox-locale', locale);
  document.documentElement.lang = locale;
}

export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key];
}
