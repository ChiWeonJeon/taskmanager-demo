import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET() {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { projectMembers: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(roles);
}

export async function POST(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, permissions } = body;

  if (!name) {
    return NextResponse.json(
      { error: messages.errors.roleNameRequired },
      { status: 400 }
    );
  }

  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: messages.errors.roleNameAlreadyExists },
      { status: 409 }
    );
  }

  const role = await prisma.role.create({
    data: {
      name,
      description: description || null,
      permissions: JSON.stringify(permissions || []),
    },
  });

  return NextResponse.json(role, { status: 201 });
}
