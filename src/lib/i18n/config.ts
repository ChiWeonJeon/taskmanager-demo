export const SUPPORTED_LOCALES = ["ko", "en", "en-US", "ja"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "ko";
export const LOCALE_COOKIE_NAME = "taskmanager-locale";
export const LOCALE_STORAGE_KEY = "taskmanager-locale";

const LOCALE_ALIASES: Record<string, AppLocale> = {
  ko: "ko",
  "ko-kr": "ko",
  en: "en",
  "en-gb": "en",
  "en-us": "en-US",
  ja: "ja",
  "ja-jp": "ja",
};

export function normalizeLocale(input?: string | null): AppLocale {
  if (!input) return DEFAULT_LOCALE;

  const normalized = input.trim().toLowerCase();
  if (LOCALE_ALIASES[normalized]) {
    return LOCALE_ALIASES[normalized];
  }

  const base = normalized.split("-")[0];
  if (base === "ko") return "ko";
  if (base === "ja") return "ja";
  if (normalized.startsWith("en-us")) return "en-US";
  if (base === "en") return "en";

  return DEFAULT_LOCALE;
}
