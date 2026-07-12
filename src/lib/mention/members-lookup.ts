import { prisma } from "@/lib/db";

export interface MentionMember {
  id: string;
  name: string;
  email: string;
}

interface ProjectShape {
  id: string;
  isPersonal: boolean;
  ownerId: string | null;
}

// Shared by project member mention autocomplete endpoints.
// Returns project members (+ owner for personal projects) matching `q` (case-insensitive)
// on name or email. Maximum `limit` results.
export async function queryProjectMembersForLookup(
  project: ProjectShape,
  q: string,
  limit = 10
): Promise<MentionMember[]> {
  const needle = q.trim().toLowerCase();

  if (project.isPersonal) {
    const owner = project.ownerId
      ? await prisma.user.findUnique({
          where: { id: project.ownerId },
          select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true },
        })
      : null;
    if (!owner) return [];
    if (
      needle === "" ||
      owner.name.toLowerCase().includes(needle) ||
      owner.email.toLowerCase().includes(needle)
    ) {
      return [owner];
    }
    return [];
  }

  const members = await prisma.projectMember.findMany({
    where: {
      projectId: project.id,
      ...(needle
        ? {
            OR: [
              { user: { name: { contains: needle } } },
              { user: { email: { contains: needle } } },
            ],
          }
        : {}),
    },
    include: { user: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => m.user);
}
