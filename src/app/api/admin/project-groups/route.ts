import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET() {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.adminPermissionRequired }, { status: 403 });
  }

  const groups = await prisma.projectGroup.findMany({
    include: {
      owner: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
      _count: { select: { projects: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(groups);
}
