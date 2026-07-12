import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/checklists/order
// Body: { ids: string[] }  — array of checklist ids in the desired order.
// Reassigns sortOrder = index. Ids that don't belong to the project are ignored.
export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
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

  const projectId = auth.access.project!.id;
  const owned = await prisma.checklist.findMany({
    where: { projectId, id: { in: ids } },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((c) => c.id));
  const ordered = ids.filter((id) => ownedSet.has(id));

  await prisma.$transaction(
    ordered.map((cid, idx) =>
      prisma.checklist.update({ where: { id: cid }, data: { sortOrder: idx } })
    )
  );

  return NextResponse.json({ ok: true });
}
