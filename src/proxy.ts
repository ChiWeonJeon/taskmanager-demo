import NextAuth from "next-auth";
import type { NextMiddleware } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth as unknown as NextMiddleware;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
