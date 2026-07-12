import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * 자동 상속/추가 멤버에게 부여할 "기본 역할"의 id 를 해석한다.
 * 우선순위: Role.isDefault=true → 이름 "Member"/"멤버" → 비-system 첫 역할 → 첫 역할.
 * 하드코딩 금지 규약에 따라 기본 역할은 관리자가 admin 화면에서 지정한다.
 */
export async function getDefaultRoleId(client: DbClient = prisma): Promise<string | null> {
  const flagged = await client.role.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (flagged) return flagged.id;

  const named = await client.role.findFirst({
    where: { name: { in: ["Member", "멤버"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (named) return named.id;

  const nonSystem = await client.role.findFirst({
    where: { isSystem: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (nonSystem) return nonSystem.id;

  const any = await client.role.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return any?.id ?? null;
}

/**
 * 특정 역할을 유일한 기본 역할로 지정한다(단일 default 불변식).
 * 트랜잭션 내에서 호출해야 안전하다.
 */
export async function setDefaultRole(client: DbClient, roleId: string): Promise<void> {
  await client.role.updateMany({ where: { isDefault: true, NOT: { id: roleId } }, data: { isDefault: false } });
  await client.role.update({ where: { id: roleId }, data: { isDefault: true } });
}
