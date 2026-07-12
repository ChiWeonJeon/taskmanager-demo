import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n/config";
import { getLocaleMessages, type LocaleMessages } from "@/lib/i18n/messages";

// Returns locale + messages for server components, respecting the same
// cookie → Accept-Language precedence as the root layout.
export async function getServerMessages(): Promise<LocaleMessages> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) {
    return getLocaleMessages(normalizeLocale(cookieLocale));
  }
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  const preferredLocale = acceptLanguage?.split(",")[0];
  return getLocaleMessages(normalizeLocale(preferredLocale));
}
