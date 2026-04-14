import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['de', 'en', 'pl', 'cs', 'ro', 'sl', 'sk', 'tr', 'el', 'fr'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'de';

export const localeNames: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  pl: 'Polski',
  cs: 'Čeština',
  ro: 'Română',
  sl: 'Slovenščina',
  sk: 'Slovenčina',
  tr: 'Türkçe',
  el: 'Ελληνικά',
  fr: 'Français',
};

export const localeFlags: Record<Locale, string> = {
  de: '🇩🇪',
  en: '🇬🇧',
  pl: '🇵🇱',
  cs: '🇨🇿',
  ro: '🇷🇴',
  sl: '🇸🇮',
  sk: '🇸🇰',
  tr: '🇹🇷',
  el: '🇬🇷',
  fr: '🇫🇷',
};

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('locale')?.value as Locale) || defaultLocale;
  
  return {
    locale,
    messages: (await import(`../../locales/${locale}.json`)).default,
  };
});
