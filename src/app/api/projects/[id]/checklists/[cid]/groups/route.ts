import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveChecklistAccess, checklistError } from "@/lib/checklist/api";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string; cid: string }> };

const GROUP_SELECT = {
  id: true,
  checklistId: true,
  name: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET — list groups under a checklist (sorted).
export async function GET(_request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:read");
  if (!auth.ok) return auth.response;

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const groups = await prisma.checklistItemGroup.findMany({
    where: { checklistId: cid },
    orderBy: { sortOrder: "asc" },
    select: GROUP_SELECT,
  });
  return NextResponse.json({ groups });
}

// POST — create a new group at the end of the existing list.
export async function POST(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cid } = await params;
  const auth = await resolveChecklistAccess(id, "checklist:edit");
  if (!auth.ok) return auth.response;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return checklistError(messages.errors.invalidRequestBody, "CHECKLIST_BAD_REQUEST", 400);
  }
  const name = (body.name ?? "").trim();
  if (!name) {
    return checklistError(messages.errors.titleRequired, "CHECKLIST_BAD_REQUEST", 400);
  }

  const checklist = await prisma.checklist.findFirst({
    where: { id: cid, projectId: auth.access.project!.id },
    select: { id: true },
  });
  if (!checklist) {
    return checklistError(messages.errors.checklistNotFound, "CHECKLIST_NOT_FOUND", 404);
  }

  const last = await prisma.checklistItemGroup.findFirst({
    where: { checklistId: cid },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = (last?.sortOrder ?? -1) + 1;

  const group = await prisma.checklistItemGroup.create({
    data: { checklistId: cid, name, sortOrder: nextOrder },
    select: GROUP_SELECT,
  });
  return NextResponse.json({ group }, { status: 201 });
}
