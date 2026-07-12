import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManageGroup } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { resolveGroupCycleAccess, cycleError } from "@/lib/cycle/api";

type Ctx = { params: Promise<{ slugOrId: string; cycleId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { slugOrId, cycleId } = await params;
  const auth = await resolveGroupCycleAccess(slugOrId);
  if (!auth.ok) return auth.response;
  if (!canManageGroup(auth.access)) return cycleError(messages.errors.forbidden, "FORBIDDEN", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cycleError(messages.errors.invalidRequestBody, "BAD_REQUEST", 400);
  }
  const projectId = typeof (body as { projectId?: unknown }).projectId === "string"
    ? (body as { projectId: string }).projectId
    : "";
  const enabled = (body as { enabled?: unknown }).enabled;
  if (!projectId || typeof enabled !== "boolean") {
    return cycleError(messages.errors.badRequest, "BAD_REQUEST", 400);
  }

  const groupId = auth.access.group!.id;
  const [cycle, project] = await Promise.all([
    prisma.cycle.findFirst({
      where: { id: cycleId, scope: "GROUP", groupId, deletedAt: null },
      select: { id: true },
    }),
    prisma.project.findFirst({ where: { id: projectId, groupId }, select: { id: true } }),
  ]);
  if (!cycle || !project) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  await prisma.cycleProjectInheritance.upsert({
    where: { cycleId_projectId: { cycleId, projectId } },
    update: { enabled },
    create: { cycleId, projectId, enabled },
  });

  return NextResponse.json({ ok: true, enabled });
}
