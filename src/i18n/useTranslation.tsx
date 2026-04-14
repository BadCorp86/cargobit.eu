'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import type { Locale } from './config';
import { locales, defaultLocale, localeNames, localeFlags } from './config';

interface TranslationContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  localeNames: Record<Locale, string>;
  localeFlags: Record<Locale, string>;
  locales: readonly Locale[];
}

const TranslationContext = createContext<TranslationContextType | null>(null);

// Cache for loaded translations
const translationCache: Record<Locale, Record<string, unknown>> = {} as Record<Locale, Record<string, unknown>>;

// Helper to get nested value from object
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}

// Replace template variables like {name} with actual values
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key]?.toString() ?? match;
  });
}

// Get initial locale from cookie (client-side only)
function getInitialLocale(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  
  const savedLocale = document.cookie
    .split('; ')
    .find(row => row.startsWith('locale='))
    ?.split('=')[1] as Locale | undefined;
  
  return savedLocale && locales.includes(savedLocale) ? savedLocale : defaultLocale;
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  // Initialize state with a function to avoid the lint error
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [translations, setTranslations] = useState<Record<string, unknown>>({});

  // Load translations when locale changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (translationCache[locale]) {
        setTranslations(translationCache[locale]);
        return;
      }
      
      try {
        const response = await fetch(`/locales/${locale}.json`);
        const data = await response.json();
        translationCache[locale] = data;
        setTranslations(data);
      } catch (error) {
        console.error('Failed to load translations:', error);
        // Fallback to default locale
        if (locale !== defaultLocale) {
          try {
            const response = await fetch(`/locales/${defaultLocale}.json`);
            const data = await response.json();
            setTranslations(data);
          } catch {
            // Silent fail for fallback
          }
        }
      }
    };
    
    loadTranslations();
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Save to cookie
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const value = getNestedValue(translations, key);
    if (value === undefined) {
      return key;
    }
    return interpolate(value, params);
  }, [translations]);

  return (
    <TranslationContext.Provider value={{ 
      locale, 
      setLocale, 
      t, 
      localeNames, 
      localeFlags,
      locales 
    }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
