import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getDefaultRoleId } from "@/lib/roles";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * 그룹→프로젝트 멤버 상속 실체화 동기화.
 *
 * 권한 모델: 프로젝트 접근/권한의 단일 출처는 `ProjectMember` 행이다. 그룹 멤버십은
 * (프로젝트) 역할을 갖지 않으며, 대신 그룹의 각 프로젝트에 `source="group"` ProjectMember
 * 행으로 실체화된다. 직접(`source="direct"`) 멤버십이 이미 있으면 보존(직접 우선),
 * 프로젝트 소유자/개인 프로젝트는 건너뛴다. 모든 함수는 멱등하다.
 */

/** 그룹 멤버 1명을 그룹의 모든 (비개인) 프로젝트에 group-sourced 멤버로 실체화. */
export async function materializeGroupMemberInProjects(
  client: DbClient,
  groupId: string,
  userId: string,
  defaultRoleId?: string | null,
): Promise<void> {
  const roleId = defaultRoleId ?? (await getDefaultRoleId(client));
  if (!roleId) return;

  const projects = await client.project.findMany({
    where: { groupId, isPersonal: false },
    select: { id: true, ownerId: true },
  });

  for (const project of projects) {
    if (project.ownerId === userId) continue; // 소유자는 이미 멤버
    const existing = await client.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId } },
      select: { id: true },
    });
    if (existing) continue; // 직접/기존 멤버 우선
    await client.projectMember.create({
      data: { projectId: project.id, userId, roleId, source: "group", groupId },
    });
  }
}

/** 그룹 탈퇴 시: 해당 그룹에서 상속된(group-sourced) 멤버 행만 제거(직접 멤버 보존). */
export async function removeGroupMemberFromProjects(
  client: DbClient,
  groupId: string,
  userId: string,
): Promise<void> {
  await client.projectMember.deleteMany({ where: { userId, source: "group", groupId } });
}

/** 프로젝트가 그룹에 편입될 때: 그룹의 모든 멤버를 group-sourced 멤버로 실체화. */
export async function materializeAllGroupMembersInProject(
  client: DbClient,
  projectId: string,
  groupId: string,
): Promise<void> {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, isPersonal: true },
  });
  if (!project || project.isPersonal) return;

  const roleId = await getDefaultRoleId(client);
  if (!roleId) return;

  const members = await client.projectGroupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  for (const member of members) {
    if (project.ownerId === member.userId) continue;
    const existing = await client.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: member.userId } },
      select: { id: true },
    });
    if (existing) continue;
    await client.projectMember.create({
      data: { projectId, userId: member.userId, roleId, source: "group", groupId },
    });
  }
}

/** 프로젝트가 그룹에서 제외될 때: 그 그룹에서 상속된 멤버 행 제거. */
export async function removeGroupSourcedFromProject(
  client: DbClient,
  projectId: string,
  groupId: string,
): Promise<void> {
  await client.projectMember.deleteMany({ where: { projectId, source: "group", groupId } });
}

/** 그룹 삭제 시: 그 그룹에서 상속된 모든 멤버 행 제거. */
export async function removeAllGroupSourced(client: DbClient, groupId: string): Promise<void> {
  await client.projectMember.deleteMany({ where: { source: "group", groupId } });
}
