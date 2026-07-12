import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getGroupAccess, type GroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { getProjectAccess, type ProjectAccess } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { canReadCycle, requireCyclePermission, type CyclePermission } from "./permissions";

type Session = Awaited<ReturnType<typeof requireAuth>>;
type SessionUser = Session["user"] | null | undefined;

export async function resolveCycleAccess(
  projectIdOrKey: string,
  permission: CyclePermission,
): Promise<
  | { ok: true; access: ProjectAccess; session: Session }
  | { ok: false; response: NextResponse }
> {
  const messages = await getServerMessages();
  let session: Session;
  try {
    session = await requireAuth();
  } catch {
    return { ok: false, response: NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }) };
  }

  const access = await getProjectAccess(projectIdOrKey, session.user);
  if (!access.project) {
    return { ok: false, response: NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 }) };
  }

  const allowed = permission === "cycle:read"
    ? canReadCycle(access)
    : requireCyclePermission(access, permission);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: messages.errors.forbidden, code: "CYCLE_FORBIDDEN", required: permission },
        { status: 403 },
      ),
    };
  }

  return { ok: true, access, session };
}

export async function canReadGroupCycles(access: GroupAccess, user: SessionUser) {
  if (!hasGroupAccess(access)) return false;
  if (access.isAdmin || access.isOwner) return true;
  const groupId = access.group?.id;
  if (!groupId) return false;

  const projects = await prisma.project.findMany({ where: { groupId }, select: { id: true } });
  for (const project of projects) {
    if (canReadCycle(await getProjectAccess(project.id, user))) return true;
  }
  return false;
}

export async function resolveGroupCycleAccess(
  groupSlugOrId: string,
): Promise<
  | { ok: true; access: GroupAccess; session: Session }
  | { ok: false; response: NextResponse }
> {
  const messages = await getServerMessages();
  let session: Session;
  try {
    session = await requireAuth();
  } catch {
    return { ok: false, response: NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }) };
  }

  const access = await getGroupAccess(groupSlugOrId, session.user);
  if (!access.group) {
    return { ok: false, response: NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 }) };
  }
  if (!hasGroupAccess(access)) {
    return { ok: false, response: NextResponse.json({ error: messages.errors.groupAccessRequired }, { status: 403 }) };
  }
  if (!(await canReadGroupCycles(access, session.user))) {
    return { ok: false, response: NextResponse.json({ error: messages.errors.forbidden, code: "CYCLE_FORBIDDEN" }, { status: 403 }) };
  }

  return { ok: true, access, session };
}

export function cycleError(message: string, code: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, code, ...(extra ?? {}) }, { status });
}
