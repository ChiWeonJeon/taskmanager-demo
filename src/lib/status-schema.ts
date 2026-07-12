// Status schema 응답 include + 전이(transition) 입력 정규화 유틸.

export const statusSchemaAdminInclude = {
  startStatus: true,
  statuses: {
    include: { status: true },
    orderBy: { sortOrder: "asc" as const },
  },
  transitions: {
    select: { fromStatusId: true, toStatusId: true },
  },
  issueTypes: {
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" as const },
  },
};

// from → to 전이 입력을 검증한다: self-loop 제거, 스키마에 속한 상태만 허용, 중복 제거.
export function normalizeStatusTransitions(
  transitions: { fromStatusId?: string; toStatusId?: string }[] | undefined | null,
  statusIds: string[],
) {
  if (!transitions) return [] as { fromStatusId: string; toStatusId: string }[];

  const allowed = new Set(statusIds);
  const seen = new Set<string>();
  const result: { fromStatusId: string; toStatusId: string }[] = [];

  for (const transition of transitions) {
    const from = transition?.fromStatusId;
    const to = transition?.toStatusId;
    if (typeof from !== "string" || typeof to !== "string") continue;
    if (from === to) continue;
    if (!allowed.has(from) || !allowed.has(to)) continue;

    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ fromStatusId: from, toStatusId: to });
  }

  return result;
}
