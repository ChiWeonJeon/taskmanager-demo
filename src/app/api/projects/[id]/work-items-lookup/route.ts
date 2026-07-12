import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, hasProjectAccess } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { scopedWorkItemWhere } from "@/lib/work-item-query";

type Ctx = { params: Promise<{ id: string }> };

// Autocomplete endpoint for `#`-triggered issue mentions in the rich text
// editor. Matches on issueKey prefix or title substring (case-insensitive,
// applied on lowercased fields — matches the pattern used by
// `queryProjectMembersForLookup`). Requires project access; returns up to
// 10 items ordered by most recent activity.
export async function GET(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const access = await getProjectAccess(id, session.user);
  if (!access.project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (!hasProjectAccess(access)) {
    return NextResponse.json({ error: messages.errors.projectAccessRequired }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const needle = q.toLowerCase();

  const items = await prisma.workItem.findMany({
    where: scopedWorkItemWhere({
      projectId: access.project.id,
      deletedAt: null,
      ...(needle
        ? {
            OR: [
              { issueKey: { contains: needle } },
              { title: { contains: needle } },
            ],
          }
        : {}),
    }),
    select: { id: true, issueKey: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    items: items.map((w) => ({ id: w.id, issueKey: w.issueKey, title: w.title })),
  });
}
