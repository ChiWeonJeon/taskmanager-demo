import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { isDemoMode, isDemoReadOnly } from "@/lib/demo";

function readVersionFile() {
  try {
    return readFileSync(join(process.cwd(), "VERSION"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

export async function GET() {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }
  return NextResponse.json({
    status: database === "ok" ? "ok" : "degraded",
    version: readVersionFile() ?? process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? "unknown",
    database,
    demo: isDemoMode(),
    readOnly: isDemoReadOnly(),
  }, { status: database === "ok" ? 200 : 503 });
}
