import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string }> };

// POST /groups/order — body: { ids: string[] }. Reassigns sortOrder = index for
// each owned group; foreign ids are ignored.
export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }
  if (!Array.isArray(body.ids) || !body.ids.every((x) => typeof x === "string")) {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }
  const ids = body.ids as string[];

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const owned = await prisma.checklistItemGroup.findMany({
    where: { checklistId: cid, id: { in: ids } },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((g) => g.id));
  const ordered = ids.filter((x) => ownedSet.has(x));

  await prisma.$transaction(
    ordered.map((gid, idx) =>
      prisma.checklistItemGroup.update({ where: { id: gid }, data: { sortOrder: idx } })
    )
  );
  return NextResponse.json({ ok: true });
}
