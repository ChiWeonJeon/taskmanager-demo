import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, type ProjectAccess } from "@/lib/project-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import {
  canReadChecklist,
  requireChecklistPermission,
  type ChecklistPermission,
} from "./permissions";

type Session = Awaited<ReturnType<typeof requireAuth>>;

export async function resolveChecklistAccess(
  projectIdOrKey: string,
  permission: ChecklistPermission
): Promise<
  | { ok: true; access: ProjectAccess; session: Session }
  | { ok: false; response: NextResponse }
> {
  const messages = await getServerMessages();
  let session: Session;
  try {
    session = await requireAuth();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 }),
    };
  }

  const access = await getProjectAccess(projectIdOrKey, session.user);
  if (!access.project) {
    return {
      ok: false,
      response: NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 }),
    };
  }

  if (permission === "checklist:read") {
    if (!canReadChecklist(access)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: messages.errors.forbidden, code: "CHECKLIST_FORBIDDEN", required: permission },
          { status: 403 }
        ),
      };
    }
  } else if (!requireChecklistPermission(access, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: messages.errors.forbidden, code: "CHECKLIST_FORBIDDEN", required: permission },
        { status: 403 }
      ),
    };
  }

  return { ok: true, access, session };
}

export function checklistError(
  message: string,
  code: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: message, code, ...(extra ?? {}) }, { status });
}
