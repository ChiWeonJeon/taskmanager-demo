import { NextRequest, NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { normalizeEmail } from "@/lib/admin-access";
import { getServerMessages } from "@/lib/i18n/server";

export async function GET() {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const messages = await getServerMessages();
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, password, role } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: messages.errors.nameEmailPasswordRequired },
      { status: 400 }
    );
  }

  const normalizedEmail = normalizeEmail(email);

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json(
      { error: messages.errors.emailAlreadyInUse },
      { status: 409 }
    );
  }

  const hashedPassword = await bcryptjs.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: role === "ADMIN" ? "ADMIN" : "USER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
