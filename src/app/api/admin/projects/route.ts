import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET() {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      isPersonal: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          members: true,
          workItems: true,
        },
      },
    },
    orderBy: [{ isPersonal: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(
    projects.map(({ _count, ...project }) => ({
      ...project,
      memberCount: _count.members,
      workItemCount: _count.workItems,
    }))
  );
}
