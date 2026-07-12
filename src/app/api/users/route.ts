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

  const users = await prisma.user.findMany({
    select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
