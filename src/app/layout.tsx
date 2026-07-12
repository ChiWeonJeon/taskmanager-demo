import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { SessionProvider } from "@/components/shared/session-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { QueryProvider } from "@/components/shared/query-provider";
import { LocaleProvider } from "@/components/shared/locale-provider";
import { ToastContainer } from "@/components/ui/toast";
import { LOCALE_COOKIE_NAME, normalizeLocale } from "@/lib/i18n/config";
import { getServerMessages } from "@/lib/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getServerMessages();
  return {
    title: messages.app.name,
    description: messages.app.description,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

async function getInitialLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) {
    return normalizeLocale(cookieLocale);
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  const preferredLocale = acceptLanguage?.split(",")[0];
  return normalizeLocale(preferredLocale);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = await getInitialLocale();
  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body className="antialiased">
        <LocaleProvider initialLocale={initialLocale}>
          <SessionProvider>
            <ThemeProvider>
              <QueryProvider>{children}</QueryProvider>
            </ThemeProvider>
            <ToastContainer />
          </SessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
