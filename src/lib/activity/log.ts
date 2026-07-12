import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// kind 명명 규약: "<subject>.<action>"
// subject: member | settings | checklist | workitem | group
// action: added | removed | role_changed | created | updated | deleted | restored
export type ProjectActivityKind =
  | "member.added"
  | "member.removed"
  | "member.role_changed"
  | "settings.updated"
  | "checklist.created"
  | "checklist.deleted"
  | "workitem.created"
  | "workitem.deleted"
  | "cycle.created"
  | "cycle.updated"
  | "cycle.deleted";

export type ProjectGroupActivityKind =
  | "member.added"
  | "member.removed"
  | "member.role_changed"
  | "settings.updated"
  | "project.added"
  | "project.removed"
  | "cycle.created"
  | "cycle.updated"
  | "cycle.deleted";

export type ActivitySubjectType =
  | "user"
  | "project"
  | "page"
  | "checklist"
  | "workitem"
  | "group"
  | "cycle";

interface LogProjectActivityArgs {
  tx?: Prisma.TransactionClient;
  projectId: string;
  actorId: string | null;
  kind: ProjectActivityKind;
  subjectType?: ActivitySubjectType;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
}

interface LogProjectGroupActivityArgs {
  tx?: Prisma.TransactionClient;
  projectGroupId: string;
  actorId: string | null;
  kind: ProjectGroupActivityKind;
  subjectType?: ActivitySubjectType;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
}

// Best-effort logger. Activity is observability, not a hard invariant — never
// abort the parent mutation if the activity insert fails. Same convention as
// notifyMention etc. Errors are swallowed and logged to console for triage.
export async function logProjectActivity({
  tx,
  projectId,
  actorId,
  kind,
  subjectType,
  subjectId,
  payload,
}: LogProjectActivityArgs): Promise<void> {
  const client = tx ?? prisma;
  try {
    await client.projectActivity.create({
      data: {
        projectId,
        actorId,
        kind,
        subjectType: subjectType ?? null,
        subjectId: subjectId ?? null,
        payload: payload ? JSON.stringify(payload) : null,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log project activity", { projectId, kind, err });
  }
}

export async function logProjectGroupActivity({
  tx,
  projectGroupId,
  actorId,
  kind,
  subjectType,
  subjectId,
  payload,
}: LogProjectGroupActivityArgs): Promise<void> {
  const client = tx ?? prisma;
  try {
    await client.projectGroupActivity.create({
      data: {
        projectGroupId,
        actorId,
        kind,
        subjectType: subjectType ?? null,
        subjectId: subjectId ?? null,
        payload: payload ? JSON.stringify(payload) : null,
      },
    });
  } catch (err) {
    console.error("[activity] failed to log group activity", { projectGroupId, kind, err });
  }
}
