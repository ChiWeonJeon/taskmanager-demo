import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { DEMO_USER_ID, isDemoMode } from "@/lib/demo";

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "demo",
      name: "Project Aetherfall Demo",
      credentials: {},
      async authorize() {
        if (!isDemoMode()) return null;
        const user = await prisma.user.findUnique({
          where: { id: DEMO_USER_ID },
          select: { id: true, email: true, name: true },
        });
        return user ? { ...user, role: "USER" } : null;
      },
    }),
  ],
});

export const { handlers, signIn, signOut } = nextAuth;

export async function auth(): Promise<Session | null> {
  return nextAuth.auth();
}
