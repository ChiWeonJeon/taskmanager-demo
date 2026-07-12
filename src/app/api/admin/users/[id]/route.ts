import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { role } = body;

  if (session.user.id === id) {
    return NextResponse.json(
      { error: messages.errors.cannotChangeOwnRole },
      { status: 400 }
    );
  }

  if (role !== "ADMIN" && role !== "USER") {
    return NextResponse.json(
      { error: messages.errors.invalidRoleValue },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const { id } = await params;

  if (session.user.id === id) {
    return NextResponse.json(
      { error: messages.errors.cannotDeleteSelf },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
