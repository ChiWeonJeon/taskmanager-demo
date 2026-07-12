import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET() {
  const messages = await getServerMessages();
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      permissions: true,
      isSystem: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(roles);
}
