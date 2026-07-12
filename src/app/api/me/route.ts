import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getServerMessages } from "@/lib/i18n/server";

const NAME_MAX = 80;
const SHORT_NAME_MAX = 40;

export async function GET() {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      shortName: true,
      role: true,
      avatarUpdatedAt: true,
      createdAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: messages.errors.userNotFound }, { status: 404 });
  }
  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: messages.errors.invalidRequestBody }, { status: 400 });
  }

  const { name, shortName } = body as { name?: unknown; shortName?: unknown };

  const data: { name?: string; shortName?: string | null } = {};

  if (name !== undefined) {
    if (typeof name !== "string") {
      return NextResponse.json({ error: messages.errors.invalidInput }, { status: 400 });
    }
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > NAME_MAX) {
      return NextResponse.json({ error: messages.errors.invalidInput }, { status: 400 });
    }
    data.name = trimmed;
  }

  if (shortName !== undefined) {
    if (shortName === null) {
      data.shortName = null;
    } else if (typeof shortName !== "string") {
      return NextResponse.json({ error: messages.errors.invalidInput }, { status: 400 });
    } else {
      const trimmed = shortName.trim();
      if (trimmed.length === 0) {
        data.shortName = null;
      } else if (trimmed.length > SHORT_NAME_MAX) {
        return NextResponse.json({ error: messages.errors.invalidInput }, { status: 400 });
      } else {
        data.shortName = trimmed;
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      shortName: true,
      role: true,
      avatarUpdatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}
