"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "@/lib/i18n/config";
import { getLocaleMessages } from "@/lib/i18n/messages";

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  messages: ReturnType<typeof getLocaleMessages>;
  supportedLocales: readonly AppLocale[];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: AppLocale;
}) {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      messages: getLocaleMessages(locale),
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale]
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useI18n must be used within LocaleProvider");
  }

  return context;
}
