import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/admin-access";

export const PROJECT_FULL_PERMISSIONS = [
  "project:manage",
  "members:manage",
  "workitems:create",
  "workitems:edit",
  "workitems:delete",
  "workitems:assign",
  "comments:create",
  "comments:delete",
  "checklist:read",
  "checklist:create",
  "checklist:edit",
  "checklist:delete",
  "checklist:manage",
  "cycle:read",
  "cycle:create",
  "cycle:edit",
  "cycle:delete",
  "cycle:manage",
  "group:manage",
] as const;

type SessionUserLike = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type ProjectPermissionKey = (typeof PROJECT_FULL_PERMISSIONS)[number];

export interface GroupMembershipInfo {
  groupId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
}

export interface ProjectAccess {
  project: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    isPersonal: boolean;
    ownerId: string | null;
    groupId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  membership: {
    id: string;
    projectId: string;
    userId: string;
    roleId: string;
    role: {
      id: string;
      name: string;
      permissions: string;
    };
  } | null;
  groupMembership: GroupMembershipInfo | null;
  userId: string;
  isAdmin: boolean;
  isOwner: boolean;
  permissions: Set<string>;
}

export function parsePermissions(raw: string | null | undefined) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function resolveProjectByIdOrKey(idOrKey: string) {
  return prisma.project.findFirst({
    where: { OR: [{ id: idOrKey }, { key: idOrKey }] },
  });
}

export async function getProjectAccess(idOrKey: string, user?: SessionUserLike | null): Promise<ProjectAccess> {
  const project = await resolveProjectByIdOrKey(idOrKey);
  const userId = user?.id ?? "";
  const isAdmin = isAdminUser(user ?? undefined);

  if (!project) {
    return {
      project: null,
      membership: null,
      groupMembership: null,
      userId,
      isAdmin,
      isOwner: false,
      permissions: new Set(),
    };
  }

  const membership = userId
    ? await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId } },
        include: { role: { select: { id: true, name: true, permissions: true } } },
      })
    : null;

  let groupMembership: GroupMembershipInfo | null = null;
  if (userId && project.groupId) {
    const gm = await prisma.projectGroupMember.findUnique({
      where: { groupId_userId: { groupId: project.groupId, userId } },
      include: { role: { select: { id: true, name: true, permissions: true } } },
    });
    if (gm) {
      groupMembership = {
        groupId: gm.groupId,
        roleId: gm.roleId,
        roleName: gm.role.name,
        permissions: parsePermissions(gm.role.permissions),
      };
    }
  }

  const isOwner = Boolean(userId && project.ownerId === userId);
  // 프로젝트 권한의 단일 출처는 실체화된 ProjectMember.role 이다(그룹 멤버도 group-sourced
  // ProjectMember 로 실체화되어 프로젝트별 역할을 가짐). 그룹 멤버십 자체는 (프로젝트) 권한을
  // 부여하지 않는다. groupMembership 은 표시/접근 폴백 정보로만 유지한다.
  const permissions = new Set<string>([
    ...(membership ? parsePermissions(membership.role.permissions) : []),
    ...(isAdmin || isOwner ? PROJECT_FULL_PERMISSIONS : []),
  ]);

  return {
    project,
    membership,
    groupMembership,
    userId,
    isAdmin,
    isOwner,
    permissions,
  };
}

export function hasProjectAccess(access: ProjectAccess) {
  if (!access.project) return false;
  if (access.project.isPersonal) {
    return access.isAdmin || access.isOwner;
  }
  return access.isAdmin || access.isOwner || Boolean(access.membership) || Boolean(access.groupMembership);
}

export function hasProjectPermission(access: ProjectAccess, permission: ProjectPermissionKey) {
  return access.permissions.has(permission);
}

export async function getProjectAdminRoleId(client: Prisma.TransactionClient | typeof prisma) {
  const role = await client.role.findFirst({
    where: {
      OR: [
        { name: "Project Admin" },
        { name: "프로젝트 어드민" },
      ],
    },
    select: { id: true },
  });
  return role?.id ?? null;
}

export async function ensureProjectOwnerMembership(
  client: Prisma.TransactionClient | typeof prisma,
  projectId: string,
  ownerId: string
) {
  const adminRoleId = await getProjectAdminRoleId(client);
  if (!adminRoleId) return null;

  return client.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: ownerId } },
    update: {},
    create: {
      projectId,
      userId: ownerId,
      roleId: adminRoleId,
    },
  });
}
