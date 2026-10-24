import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { I18nContext, type I18n } from "./context";
import { de } from "./de";
import { en, type Messages } from "./en";
import { createFormat } from "./format";
import { LOCALES, STORAGE_KEY, type Locale, detectLocale } from "./locales";
import { tr } from "./tr";

const MESSAGES: Record<Locale, Messages> = { en, tr, de };

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18n>(() => {
    const tag = LOCALES.find((l) => l.code === locale)!.tag;
    return { locale, setLocale, t: MESSAGES[locale], f: createFormat(tag) };
  }, [locale, setLocale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}
