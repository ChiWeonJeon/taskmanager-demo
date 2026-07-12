import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/admin-access";
import { PROJECT_FULL_PERMISSIONS } from "@/lib/project-permissions";

type SessionUserLike = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

export interface GroupAccess {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  membership: {
    id: string;
    groupId: string;
    userId: string;
    roleId: string;
    role: {
      id: string;
      name: string;
      permissions: string;
    };
  } | null;
  userId: string;
  isAdmin: boolean;
  isOwner: boolean;
  permissions: Set<string>;
}

export async function resolveGroupByIdOrSlug(idOrSlug: string) {
  // Page/layout server components receive route params still percent-encoded,
  // while Route Handlers receive them already decoded. Group slugs can contain
  // non-ASCII characters (e.g. Korean), so match against both the raw and the
  // decoded form to resolve consistently from either caller.
  const candidates = new Set<string>([idOrSlug]);
  try {
    candidates.add(decodeURIComponent(idOrSlug));
  } catch {
    // Malformed percent-encoding — fall back to the raw value only.
  }
  const values = [...candidates];

  return prisma.projectGroup.findFirst({
    where: { OR: values.flatMap((value) => [{ id: value }, { slug: value }]) },
  });
}

export async function getGroupAccess(
  idOrSlug: string,
  user?: SessionUserLike | null,
): Promise<GroupAccess> {
  const group = await resolveGroupByIdOrSlug(idOrSlug);
  const userId = user?.id ?? "";
  const isAdmin = isAdminUser(user ?? undefined);

  if (!group) {
    return {
      group: null,
      membership: null,
      userId,
      isAdmin,
      isOwner: false,
      permissions: new Set(),
    };
  }

  const membership = userId
    ? await prisma.projectGroupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId } },
        include: { role: { select: { id: true, name: true, permissions: true } } },
      })
    : null;

  const isOwner = Boolean(userId && group.ownerId === userId);
  // 그룹 멤버십은 (프로젝트) 역할을 갖지 않는다 → 그룹 멤버 역할로부터 권한을 도출하지 않는다.
  // 그룹 관리 권한은 owner + system admin 에게만 부여한다. 일반 그룹 멤버십은 그룹의 각
  // 프로젝트에 ProjectMember 로 실체화되어 프로젝트별 역할을 통해 권한을 갖는다.
  const permissions = new Set<string>(isAdmin || isOwner ? PROJECT_FULL_PERMISSIONS : []);

  return {
    group,
    membership,
    userId,
    isAdmin,
    isOwner,
    permissions,
  };
}

export function hasGroupAccess(access: GroupAccess) {
  if (!access.group) return false;
  return access.isAdmin || access.isOwner || Boolean(access.membership);
}

export function hasGroupPermission(access: GroupAccess, permission: string) {
  return access.permissions.has(permission);
}

export function canManageGroup(access: GroupAccess) {
  // 그룹 멤버십이 role-less 가 되었으므로 위임용 group:manage 경로를 제거.
  return access.isAdmin || access.isOwner;
}

export async function getGroupAdminRoleId(
  client: Prisma.TransactionClient | typeof prisma,
) {
  const role = await client.role.findFirst({
    where: {
      OR: [{ name: "Project Admin" }, { name: "프로젝트 어드민" }],
    },
    select: { id: true },
  });
  return role?.id ?? null;
}

export async function ensureGroupOwnerMembership(
  client: Prisma.TransactionClient | typeof prisma,
  groupId: string,
  ownerId: string,
) {
  const adminRoleId = await getGroupAdminRoleId(client);
  if (!adminRoleId) return null;

  return client.projectGroupMember.upsert({
    where: { groupId_userId: { groupId, userId: ownerId } },
    update: {},
    create: {
      groupId,
      userId: ownerId,
      roleId: adminRoleId,
    },
  });
}

export function slugifyGroupName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\uac00-\ud7a3]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
  return base || `group-${Date.now().toString(36)}`;
}
