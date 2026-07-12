import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { scopedWorkItemWhere } from "@/lib/work-item-query";
import {
  extractBodyMentionIds,
  extractBodyMentionRefs,
  extractLegacyHandles,
  filterUserMentionIds,
  type MentionRef,
} from "./extract";

type Client = typeof prisma | Prisma.TransactionClient;

// Resolve a markdown body to the set of mentioned User.id values.
// - Canonical syntax `[@label](user:ID)` is the authoritative source. We only
//   keep IDs whose user is actually a member of the project (or the project's
//   owner) to prevent injection of unrelated User.ids via crafted markdown.
// - When no canonical mentions are present, fall back to the legacy `@handle`
//   pattern. Handles are matched against
//   email local-part / name within project members. This branch is kept so that
//   newly-written comments using the legacy textarea path (if any remains) still
//   produce mentions data.
export async function resolveMentionIds(
  client: Client,
  markdown: string,
  projectId: string | null
): Promise<string[]> {
  const canonical = extractBodyMentionIds(markdown);
  if (canonical.length > 0) {
    if (!projectId) return Array.from(new Set(canonical));
    const allowed = await filterUserIdsByProjectAccess(client, canonical, projectId);
    return allowed;
  }

  const handles = extractLegacyHandles(markdown);
  if (handles.length === 0) return [];

  const users = await client.user.findMany({
    where: {
      ...(projectId
        ? {
            OR: [
              { projectMembers: { some: { projectId } } },
              { ownedProjects: { some: { id: projectId } } },
            ],
          }
        : {}),
      OR: handles.flatMap((h) => [
        { email: { startsWith: `${h}@` } },
        { name: { contains: h } },
      ]),
    },
    select: { id: true },
  });
  return Array.from(new Set(users.map((u) => u.id)));
}

// Resolve supported mention types (user / issue). Returns a
// permission-filtered list: cross-project references are dropped.
// `projectId` is required for issue filtering; when omitted, only user
// mentions are returned unchanged.
export async function resolveMentionRefs(
  client: Client,
  markdown: string,
  projectId: string | null
): Promise<MentionRef[]> {
  const refs = extractBodyMentionRefs(markdown);

  // Keep legacy fallback so textarea-authored comments still produce mentions.
  if (refs.length === 0) {
    const legacyUserIds = await resolveMentionIds(client, markdown, projectId);
    return legacyUserIds.map((id) => ({ type: "user" as const, id }));
  }

  if (!projectId) return refs;

  const userIds = refs.filter((r) => r.type === "user").map((r) => r.id);
  const issueIds = refs.filter((r) => r.type === "issue").map((r) => r.id);

  const [allowedUserIds, allowedIssueIds] = await Promise.all([
    userIds.length ? filterUserIdsByProjectAccess(client, userIds, projectId) : Promise.resolve<string[]>([]),
    issueIds.length ? filterIssueIdsByProject(client, issueIds, projectId) : Promise.resolve<string[]>([]),
  ]);

  const allowUsers = new Set(allowedUserIds);
  const allowIssues = new Set(allowedIssueIds);

  return refs.filter((r) => {
    if (r.type === "user") return allowUsers.has(r.id);
    if (r.type === "issue") return allowIssues.has(r.id);
    return false;
  });
}

export async function resolveGroupMentionRefs(
  client: Client,
  markdown: string,
  groupId: string
): Promise<MentionRef[]> {
  const refs = extractBodyMentionRefs(markdown);

  if (refs.length === 0) {
    const handles = extractLegacyHandles(markdown);
    if (handles.length === 0) return [];
    const users = await client.user.findMany({
      where: {
        OR: [
          { groupMemberships: { some: { groupId } } },
          { ownedGroups: { some: { id: groupId } } },
        ],
        AND: [{
          OR: handles.flatMap((h) => [
            { email: { startsWith: `${h}@` } },
            { name: { contains: h } },
          ]),
        }],
      },
      select: { id: true },
    });
    return Array.from(new Set(users.map((user) => user.id))).map((id) => ({ type: "user" as const, id }));
  }

  const userIds = refs.filter((ref) => ref.type === "user").map((ref) => ref.id);
  const allowed = new Set(await filterUserIdsByGroupAccess(client, userIds, groupId));
  return refs.filter((ref) => ref.type === "user" && allowed.has(ref.id));
}

async function filterUserIdsByProjectAccess(
  client: Client,
  ids: string[],
  projectId: string
): Promise<string[]> {
  if (ids.length === 0) return [];
  const unique = Array.from(new Set(ids));
  const [members, project] = await Promise.all([
    client.projectMember.findMany({
      where: { projectId, userId: { in: unique } },
      select: { userId: true },
    }),
    client.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    }),
  ]);
  const allow = new Set(members.map((m) => m.userId));
  if (project?.ownerId && unique.includes(project.ownerId)) {
    allow.add(project.ownerId);
  }
  return unique.filter((id) => allow.has(id));
}

async function filterUserIdsByGroupAccess(
  client: Client,
  ids: string[],
  groupId: string
): Promise<string[]> {
  if (ids.length === 0) return [];
  const unique = Array.from(new Set(ids));
  const [members, group] = await Promise.all([
    client.projectGroupMember.findMany({
      where: { groupId, userId: { in: unique } },
      select: { userId: true },
    }),
    client.projectGroup.findUnique({
      where: { id: groupId },
      select: { ownerId: true },
    }),
  ]);
  const allow = new Set(members.map((member) => member.userId));
  if (group?.ownerId && unique.includes(group.ownerId)) {
    allow.add(group.ownerId);
  }
  return unique.filter((id) => allow.has(id));
}

async function filterIssueIdsByProject(
  client: Client,
  ids: string[],
  projectId: string
): Promise<string[]> {
  const unique = Array.from(new Set(ids));
  const rows = await client.workItem.findMany({
    where: scopedWorkItemWhere({ id: { in: unique }, projectId, deletedAt: null }),
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Convenience: only the User.id subset of resolveMentionRefs. Used by
// notifyMention callers that still operate on user IDs.
export async function resolveUserMentionIds(
  client: Client,
  markdown: string,
  projectId: string | null
): Promise<string[]> {
  const refs = await resolveMentionRefs(client, markdown, projectId);
  return filterUserMentionIds(refs);
}

// Mention notification dispatch is implemented in src/lib/notifications/server.ts
// (notifyMention). Call sites pass resolveMentionIds() / resolveUserMentionIds()
// results directly to notifyMention() within the same transaction.
