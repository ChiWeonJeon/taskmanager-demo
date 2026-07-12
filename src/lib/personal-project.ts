import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ensureProjectHasAllIssueTypes, listAllIssueTypeIds } from "@/lib/issue-type-config";
import { isDemoReadOnly } from "@/lib/demo";

function buildPersonalProjectKey(userId: string) {
  return `ME-${userId.slice(-8).toUpperCase()}`;
}

export async function ensurePersonalProjectForUser(user: { id: string; name?: string | null }) {
  if (isDemoReadOnly()) {
    const existing = await prisma.project.findFirst({
      where: { ownerId: user.id, isPersonal: true },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;
    throw new Error("Personal projects are disabled in the read-only demo.");
  }

  const key = buildPersonalProjectKey(user.id);
  const name = "My Tasks";
  const description = `${user.name ?? "User"} personal work item project`;
  const issueTypeIds = await listAllIssueTypeIds(prisma);
  const defaultIssueTypeId = issueTypeIds[0] ?? null;

  const existing = await prisma.project.findFirst({
    where: { ownerId: user.id, isPersonal: true },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        name,
        key,
        description,
        isPersonal: true,
        ownerId: user.id,
        defaultIssueTypeId: existing.defaultIssueTypeId ?? defaultIssueTypeId,
      },
    });

    await ensureProjectHasAllIssueTypes(prisma, existing.id);
    return project;
  }

  try {
    const project = await prisma.project.create({
      data: {
        name,
        key,
        isPersonal: true,
        ownerId: user.id,
        description,
        defaultIssueTypeId,
      },
    });

    await ensureProjectHasAllIssueTypes(prisma, project.id);
    return project;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.project.findFirst({
        where: { ownerId: user.id, isPersonal: true },
        orderBy: { createdAt: "asc" },
      });

      if (raced) {
        const project = await prisma.project.update({
          where: { id: raced.id },
          data: {
            name,
            key,
            description,
            isPersonal: true,
            ownerId: user.id,
            defaultIssueTypeId: raced.defaultIssueTypeId ?? defaultIssueTypeId,
          },
        });

        await ensureProjectHasAllIssueTypes(prisma, raced.id);
        return project;
      }
    }

    throw error;
  }
}
