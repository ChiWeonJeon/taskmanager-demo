import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerMessages } from "@/lib/i18n/server";
import { resolveCycleAccess, cycleError } from "@/lib/cycle/api";

type Ctx = { params: Promise<{ id: string; cycleId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id, cycleId } = await params;
  const auth = await resolveCycleAccess(id, "cycle:manage");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cycleError(messages.errors.invalidRequestBody, "BAD_REQUEST", 400);
  }
  const enabled = (body as { enabled?: unknown }).enabled;
  if (typeof enabled !== "boolean") {
    return cycleError(messages.errors.badRequest, "BAD_REQUEST", 400);
  }

  const project = auth.access.project!;
  if (!project.groupId) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  const cycle = await prisma.cycle.findFirst({
    where: { id: cycleId, scope: "GROUP", groupId: project.groupId, deletedAt: null },
    select: { id: true },
  });
  if (!cycle) return cycleError(messages.errors.notFound, "NOT_FOUND", 404);

  await prisma.cycleProjectInheritance.upsert({
    where: { cycleId_projectId: { cycleId, projectId: project.id } },
    update: { enabled },
    create: { cycleId, projectId: project.id, enabled },
  });

  return NextResponse.json({ ok: true, enabled });
}
