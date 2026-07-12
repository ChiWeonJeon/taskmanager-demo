import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getGroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { getServerMessages } from "@/lib/i18n/server";
import { getServerObjectDescriptor } from "@/lib/objects/registry-server";
import { getProjectAccess, hasProjectAccess } from "@/lib/project-permissions";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const { key } = await params;
  const projectId = request.nextUrl.searchParams.get("projectId");
  const groupId = request.nextUrl.searchParams.get("groupId");
  let project = null as {
    id: string;
    key: string;
    name: string;
    isPersonal: boolean;
    ownerId: string | null;
  } | null;

  if (projectId) {
    const access = await getProjectAccess(projectId, session.user);
    if (!access.project) {
      return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
    }
    if (!hasProjectAccess(access)) {
      return NextResponse.json({ error: messages.errors.forbidden }, { status: 403 });
    }
    project = access.project;
  }
  let group = null as {
    id: string;
    slug: string;
    name: string;
    ownerId: string;
  } | null;
  if (groupId) {
    const access = await getGroupAccess(groupId, session.user);
    if (!access.group) {
      return NextResponse.json({ error: messages.errors.groupNotFound }, { status: 404 });
    }
    if (!hasGroupAccess(access)) {
      return NextResponse.json({ error: messages.errors.groupAccessRequired }, { status: 403 });
    }
    group = access.group;
  }

  const descriptor = getServerObjectDescriptor(key);
  if (descriptor) {
    const instances = await descriptor.listInstances(prisma, {
      user: session.user,
      project,
      group,
      q: request.nextUrl.searchParams.get("q") ?? "",
      limit: Number(request.nextUrl.searchParams.get("limit") ?? 20),
    });
    return NextResponse.json({ instances });
  }

  const objectDef = await prisma.objectDef.findFirst({
    where: { key, deletedAt: null },
    select: { id: true, color: true },
  });
  if (!objectDef) {
    return NextResponse.json({ error: messages.errors.notFound }, { status: 404 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 20), 1), 200);
  const records = await prisma.objectRecord.findMany({
    where: {
      objectDefId: objectDef.id,
      deletedAt: null,
      ...(q ? { OR: [{ title: { contains: q } }, { key: { contains: q } }] } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: limit,
  });

  const instances = records.map((record) => ({
    value: record.id,
    label: record.title,
    color: objectDef.color,
  }));

  return NextResponse.json({ instances });
}
