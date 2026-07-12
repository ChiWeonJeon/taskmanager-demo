import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getProjectAccess, hasProjectAccess, hasProjectPermission } from "@/lib/project-permissions";
import { resolveProjectConfig } from "@/lib/issue-type-config";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user);

  if (!access.project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (!hasProjectAccess(access)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const config = await resolveProjectConfig(access.project.id);
  if (!config) {
    return NextResponse.json({ error: "Project configuration not found." }, { status: 404 });
  }

  // 멀티뷰의 셀 편집 게이팅 입력: 이 프로젝트에서 일감 편집 권한 보유 여부(owner/admin 은
  // PROJECT_FULL_PERMISSIONS 로 이미 포함). 조회 권한은 위 hasProjectAccess 게이트가 전제한다.
  const canEditWorkItems = hasProjectPermission(access, "workitems:edit");

  return NextResponse.json({ ...config, canEditWorkItems });
}
