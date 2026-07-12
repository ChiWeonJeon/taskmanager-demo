"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

type SessionProviderProps = {
  children: React.ReactNode;
  session?: Session | null;
};

export function SessionProvider({ children, session }: SessionProviderProps) {
  const hasInitialSession = session !== undefined;

  return (
    <NextAuthSessionProvider
      refetchOnWindowFocus={!hasInitialSession}
      session={session}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
