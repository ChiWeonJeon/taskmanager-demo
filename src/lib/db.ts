import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatabaseConfig() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (process.env.NODE_ENV === "production") {
    if (!url?.startsWith("libsql://") || !authToken) {
      throw new Error("Turso production configuration is missing or invalid.");
    }
    return { url, authToken };
  }

  return {
    url: url || process.env.LOCAL_DATABASE_URL || "file:./prisma/dev.db",
    authToken: authToken || undefined,
  };
}

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaLibSql(resolveDatabaseConfig()) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
