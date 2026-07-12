import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, hasProjectAccess } from "@/lib/project-permissions";
import { queryProjectMembersForLookup } from "@/lib/mention/members-lookup";
import { getServerMessages } from "@/lib/i18n/server";

type Ctx = { params: Promise<{ id: string }> };

// Shared member lookup used by mention autocomplete across work item comments
// and descriptions. Requires project access (membership, ownership, or admin).
// Returns up to 10 matches by name/email substring.
export async function GET(request: NextRequest, { params }: Ctx) {
  const messages = await getServerMessages();
  const { id } = await params;
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: messages.errors.unauthenticated }, { status: 401 });
  }

  const access = await getProjectAccess(id, session.user);
  if (!access.project) {
    return NextResponse.json({ error: messages.errors.projectNotFound }, { status: 404 });
  }
  if (!hasProjectAccess(access)) {
    return NextResponse.json({ error: messages.errors.projectAccessRequired }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const members = await queryProjectMembersForLookup(access.project, q);
  return NextResponse.json({ members });
}
