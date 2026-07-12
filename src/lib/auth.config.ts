import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { LOCALE_COOKIE_NAME, normalizeLocale, type AppLocale } from "@/lib/i18n/config";
import { isDemoReadOnly } from "@/lib/demo";

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error("AUTH_SECRET is required in production.");
}

const EDGE_ERRORS: Record<AppLocale, { unauthenticated: string; forbidden: string; readOnly: string }> = {
  ko: { unauthenticated: "인증이 필요합니다.", forbidden: "권한이 없습니다.", readOnly: "공개 데모는 읽기 전용입니다." },
  en: { unauthenticated: "Authentication required.", forbidden: "Permission denied.", readOnly: "The public demo is read-only." },
  "en-US": { unauthenticated: "Authentication required.", forbidden: "Permission denied.", readOnly: "The public demo is read-only." },
  ja: { unauthenticated: "認証が必要です。", forbidden: "権限がありません。", readOnly: "公開デモは読み取り専用です。" },
};

function resolveEdgeLocale(request: Request): AppLocale {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
  if (match) return normalizeLocale(decodeURIComponent(match[1]));
  return normalizeLocale((request.headers.get("accept-language") ?? "").split(",")[0]);
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      id: "demo",
      name: "Project Aetherfall Demo",
      credentials: {},
      authorize: () => null,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  secret: authSecret ?? "taskmanager-demo-local-secret",
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        (session.user as { role: string }).role = "USER";
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isApi = pathname.startsWith("/api/");
      const errors = EDGE_ERRORS[resolveEdgeLocale(request)];
      const isPublic = pathname === "/login" || pathname.startsWith("/api/auth") || pathname === "/api/health";

      if (isPublic) {
        if (auth?.user && pathname === "/login") return Response.redirect(new URL("/today", request.nextUrl));
        return true;
      }

      if (!auth?.user) {
        if (isApi) return Response.json({ error: errors.unauthenticated }, { status: 401 });
        return false;
      }

      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        if (isApi) return Response.json({ error: errors.forbidden }, { status: 403 });
        return Response.redirect(new URL("/today", request.nextUrl));
      }

      if (isApi && isDemoReadOnly() && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        return Response.json({ error: errors.readOnly, code: "DEMO_READ_ONLY" }, { status: 403 });
      }

      return true;
    },
  },
};
