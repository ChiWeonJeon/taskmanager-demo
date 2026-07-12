import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { attachWorkItemFieldValuesToDetail, workItemDetailInclude } from "@/lib/work-item-query";
import { getServerMessages } from "@/lib/i18n/server";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const messages = await getServerMessages();
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { id } = await params;

  const workItem = await prisma.workItem.findUnique({ where: { id } });
  if (!workItem) {
    return NextResponse.json({ error: messages.errors.workItemNotFound }, { status: 404 });
  }
  if (!workItem.deletedAt) {
    return NextResponse.json({ error: messages.errors.notDeletedItem }, { status: 400 });
  }

  const restored = await prisma.workItem.update({
    where: { id },
    data: { deletedAt: null },
    include: workItemDetailInclude,
  });

  return NextResponse.json(await attachWorkItemFieldValuesToDetail(prisma, restored));
}
