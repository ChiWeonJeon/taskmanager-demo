import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { ensurePersonalProjectForUser } from "@/lib/personal-project";
import { logApiError } from "@/lib/api-logger";
import { scopedWorkItemWhere, serializeWorkItemSummaries, workItemSummarySelect } from "@/lib/work-item-query";

// "모든 일감" 페이지 전용: 현재 사용자가 접근 가능한 모든 프로젝트의 일감을 반환한다.
// 접근 가능 프로젝트 = 직접/그룹상속 ProjectMember(그룹 멤버는 group-sourced 멤버로 실체화됨) ∪ 소유.
//
// TODO(ai-followup): [배경] 기존 GET /api/work-items 는 필터 없으면 deletedAt:null 만으로
// 시스템 전체 일감을 반환하는 무권한 노출 결함이 있다. [작업] 해당 핸들러에도 접근 프로젝트
// 스코핑을 강제하거나 사용처를 점검할 것. [테스트] 비멤버 계정으로 /api/work-items 호출 시
// 타 프로젝트 일감이 노출되지 않는지 확인.
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json([]);
  }

  // 개인 프로젝트 보장(실패해도 목록 조회는 계속).
  ensurePersonalProjectForUser({ id: userId, name: session.user?.name }).catch(() => {});

  const { searchParams } = new URL(request.url);
  const assigneeIdParam = searchParams.get("assigneeId");

  try {
    const [memberships, ownedProjects] = await Promise.all([
      prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
      prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } }),
    ]);

    const projectIds = Array.from(
      new Set([
        ...memberships.map((membership) => membership.projectId),
        ...ownedProjects.map((project) => project.id),
      ]),
    );

    if (projectIds.length === 0) {
      return NextResponse.json([]);
    }

    const resolvedAssigneeId =
      assigneeIdParam === "me" ? userId : assigneeIdParam ?? null;

    const workItems = await prisma.workItem.findMany({
      where: scopedWorkItemWhere({
        projectId: { in: projectIds },
        deletedAt: null,
        ...(resolvedAssigneeId ? { assigneeId: resolvedAssigneeId } : {}),
      }),
      select: workItemSummarySelect,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(await serializeWorkItemSummaries(prisma, workItems));
  } catch (error) {
    logApiError("GET", "/api/work-items/accessible", error, { userId });
    return NextResponse.json(
      { error: "Failed to load work items.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
