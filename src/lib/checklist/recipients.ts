import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parsePermissions } from "@/lib/project-permissions";

type Tx = typeof prisma | Prisma.TransactionClient;

const READ_GRANTING = new Set([
  "checklist:read",
  "checklist:create",
  "checklist:edit",
  "checklist:manage",
]);

/**
 * Resolve userIds that should receive a checklist notification for a project.
 * Includes:
 *   - all project members whose role grants checklist read (or higher)
 *   - all group members (via project's group) whose role grants checklist read
 *   - the project owner (always)
 *   - the master creator (passed in)
 * Excludes: nobody — caller's createBatch filters out the actor.
 */
export async function getChecklistRecipientIds(
  tx: Tx,
  projectId: string,
  masterCreatorId: string
): Promise<string[]> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, groupId: true },
  });
  if (!project) return [];

  const recipients = new Set<string>();
  if (project.ownerId) recipients.add(project.ownerId);
  recipients.add(masterCreatorId);

  const projectMembers = await tx.projectMember.findMany({
    where: { projectId },
    include: { role: { select: { permissions: true } } },
  });
  for (const m of projectMembers) {
    const perms = parsePermissions(m.role.permissions);
    if (perms.some((p) => READ_GRANTING.has(p))) recipients.add(m.userId);
  }

  if (project.groupId) {
    const groupMembers = await tx.projectGroupMember.findMany({
      where: { groupId: project.groupId },
      include: { role: { select: { permissions: true } } },
    });
    for (const m of groupMembers) {
      const perms = parsePermissions(m.role.permissions);
      if (perms.some((p) => READ_GRANTING.has(p))) recipients.add(m.userId);
    }
  }

  return Array.from(recipients);
}
