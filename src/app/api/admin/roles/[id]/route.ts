import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";
import { setDefaultRole } from "@/lib/roles";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, description, permissions, isDefault } = body;

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: messages.errors.roleNotFound },
      { status: 404 }
    );
  }

  if (existing.isSystem && name && name !== existing.name) {
    return NextResponse.json(
      { error: messages.errors.cannotRenameSystemRole },
      { status: 400 }
    );
  }

  if (name && name !== existing.name) {
    const duplicate = await prisma.role.findUnique({ where: { name } });
    if (duplicate) {
      return NextResponse.json(
        { error: messages.errors.roleNameAlreadyExists },
        { status: 409 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (permissions !== undefined) data.permissions = JSON.stringify(permissions);

  // 기본 역할 지정은 단일 default 불변식을 트랜잭션으로 강제한다.
  // isDefault=false 로 직접 해제하는 것은 금지(다른 역할을 기본으로 지정해 이동만 허용).
  const role = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.role.update({ where: { id }, data });
    }
    if (isDefault === true) {
      await setDefaultRole(tx, id);
    }
    return tx.role.findUniqueOrThrow({ where: { id } });
  });
  return NextResponse.json(role);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: messages.errors.roleNotFound },
      { status: 404 }
    );
  }

  if (existing.isSystem) {
    return NextResponse.json(
      { error: messages.errors.cannotDeleteSystemRole },
      { status: 400 }
    );
  }

  if (existing.isDefault) {
    return NextResponse.json(
      { error: messages.errors.cannotDeleteDefaultRole },
      { status: 400 }
    );
  }

  const memberCount = await prisma.projectMember.count({
    where: { roleId: id },
  });
  if (memberCount > 0) {
    return NextResponse.json(
      { error: messages.errors.cannotDeleteRoleInUse },
      { status: 400 }
    );
  }

  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
