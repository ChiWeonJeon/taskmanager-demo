import type { StatusOption } from "@/components/task/types";

export type StatusTransitionPair = { fromStatusId: string; toStatusId: string };
export type TransitionsByIssueType = Record<string, StatusTransitionPair[]>;

export function getAllowedStatusesForIssueType(
  issueTypeId: string | null | undefined,
  statuses: StatusOption[],
  allowedStatusIdsByIssueType?: Record<string, string[]>,
) {
  if (!issueTypeId || !allowedStatusIdsByIssueType) {
    return statuses;
  }

  const allowedIds = allowedStatusIdsByIssueType[issueTypeId];
  if (!allowedIds || allowedIds.length === 0) {
    return statuses;
  }

  return statuses.filter((status) => allowedIds.includes(status.id));
}

// 전이 규칙(클라이언트). 스키마에 전이가 없으면 제약 없음. fromId===toId 는 항상 허용.
export function isStatusTransitionAllowed(
  issueTypeId: string | null | undefined,
  fromStatusId: string | null | undefined,
  toStatusId: string,
  transitionsByIssueType?: TransitionsByIssueType,
) {
  if (!fromStatusId || fromStatusId === toStatusId) return true;
  if (!issueTypeId || !transitionsByIssueType) return true;
  const transitions = transitionsByIssueType[issueTypeId];
  if (!transitions || transitions.length === 0) return true;
  // from 상태가 전이 목록에 한 번도 등장하지 않으면(예: 유형 변경 직후) 제약하지 않는다.
  if (!transitions.some((transition) => transition.fromStatusId === fromStatusId)) return true;
  return transitions.some(
    (transition) => transition.fromStatusId === fromStatusId && transition.toStatusId === toStatusId,
  );
}

// 현재 상태에서 이동 가능한 상태만 남긴다(현재 상태는 항상 포함하여 표시값 유지).
export function getAllowedTransitionTargets(
  issueTypeId: string | null | undefined,
  currentStatusId: string | null | undefined,
  statuses: StatusOption[],
  transitionsByIssueType?: TransitionsByIssueType,
) {
  return statuses.filter(
    (status) =>
      status.id === currentStatusId
      || isStatusTransitionAllowed(issueTypeId, currentStatusId, status.id, transitionsByIssueType),
  );
}
