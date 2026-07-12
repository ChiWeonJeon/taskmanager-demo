import {
  CANONICAL_FIELD_SCHEMA_ORDER,
  EDITABLE_SYSTEM_FIELD_KEY_SET,
  ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET,
  LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET,
  getCanonicalFieldSortOrder,
  getFieldValueMap,
  parseFieldOptions,
  parseStoredFieldValue,
} from "@/lib/field-schema";
import type { FieldOption, ResolvedProjectConfig, WorkItemWithRelations } from "@/components/task/types";
import { findReferenceOption } from "@/lib/reference-options";

// 멀티 일감 뷰(목록/그리드/칸반)의 단일 컬럼 모델.
// 뷰에 로드된 일감들이 속한 이슈 유형의 구성표 필드를 프로젝트별 unionFields 에서 합집합한다.
// - issueTypeIdsHavingField: 이 필드를 가진 이슈 유형 전체(행별 편집 가능성 판정에 사용)
// - requiredIssueTypeIds: 이 필드를 필수로 요구하는 이슈 유형
export interface WorkspaceField {
  id: string;
  key: string;
  name: string;
  type: string;
  referenceObjectKey: string | null;
  isSystem: boolean;
  options: FieldOption[];
  issueTypeIdsHavingField: Set<string>;
  requiredIssueTypeIds: Set<string>;
  sortOrder: number;
}

export function isDynamicWorkspaceField(field: Pick<WorkspaceField, "isSystem" | "key">) {
  return (
    !field.isSystem ||
    (
      !EDITABLE_SYSTEM_FIELD_KEY_SET.has(field.key)
      && !LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET.has(field.key)
      && !ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key)
    )
  );
}

function dedupeOptions(options: FieldOption[]): FieldOption[] {
  const seen = new Set<string>();
  const next: FieldOption[] = [];
  for (const option of options) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    next.push(option);
  }
  return next;
}

// 커스텀 필드 정렬 시, canonical 키가 아닌 필드들이 모두 같은 sortOrder 로 묶이는 것을 방지하기 위한
// "첫 등장 순서" 기준값(시스템 필드의 canonical 인덱스 뒤에 안정적으로 배치).
const CUSTOM_FIELD_SORT_BASE = CANONICAL_FIELD_SCHEMA_ORDER.length + 100;

// 로드된 tasks 가 속한 프로젝트들의 unionFields 를 합쳐 컬럼 모델을 만든다.
// 컬럼 집합은 "로드된 전체 tasks" 기준으로 산출해 필터 변경 시 컬럼이 깜빡이지 않도록 한다(셀 편집
// 가능성은 행별 이슈 유형으로 별도 판정). 접근 권한이 없어 config 가 없는 프로젝트는 기여하지 않는다.
export function buildWorkspaceFields(
  tasks: WorkItemWithRelations[],
  configs: ResolvedProjectConfig[],
): WorkspaceField[] {
  const presentIssueTypeIds = new Set<string>();
  const presentProjectIds = new Set<string>();
  for (const task of tasks) {
    presentIssueTypeIds.add(task.issueTypeId);
    if (task.projectId) presentProjectIds.add(task.projectId);
  }

  const merged = new Map<string, WorkspaceField>();
  const firstSeen = new Map<string, number>();
  let seenCounter = 0;

  for (const config of configs) {
    if (!presentProjectIds.has(config.project.id)) continue;

    for (const unionField of config.unionFields) {
      // 뷰에 실제로 존재하는 이슈 유형 중 이 필드를 가진 게 하나도 없으면 컬럼에서 제외한다.
      if (!unionField.issueTypeIds.some((id) => presentIssueTypeIds.has(id))) continue;

      const existing = merged.get(unionField.id);
      if (!existing) {
        firstSeen.set(unionField.id, seenCounter++);
        const isSystem = unionField.isSystem;
        merged.set(unionField.id, {
          id: unionField.id,
          key: unionField.key,
          name: unionField.name,
          type: unionField.type,
          referenceObjectKey: unionField.referenceObjectKey ?? null,
          isSystem,
          options: dedupeOptions(parseFieldOptions(unionField.options)),
          issueTypeIdsHavingField: new Set(unionField.issueTypeIds),
          requiredIssueTypeIds: new Set(unionField.requiredIssueTypeIds),
          sortOrder: isSystem
            ? getCanonicalFieldSortOrder(unionField.key)
            : CUSTOM_FIELD_SORT_BASE,
        });
      } else {
        for (const id of unionField.issueTypeIds) existing.issueTypeIdsHavingField.add(id);
        for (const id of unionField.requiredIssueTypeIds) existing.requiredIssueTypeIds.add(id);
        existing.options = dedupeOptions([...existing.options, ...parseFieldOptions(unionField.options)]);
      }
    }
  }

  return Array.from(merged.values()).sort((left, right) => (
    (left.sortOrder - right.sortOrder)
    || ((firstSeen.get(left.id) ?? 0) - (firstSeen.get(right.id) ?? 0))
    || left.name.localeCompare(right.name)
  ));
}

// 행(일감) 기준 셀 편집 가능 여부: 그 일감의 이슈 유형 구성표에 이 필드가 있고(=구성표에 속함),
// 사용자가 그 프로젝트에서 일감 편집 권한이 있어야 한다. 둘 중 하나라도 아니면 읽기전용.
export function isFieldEditableForTask(
  field: WorkspaceField,
  task: WorkItemWithRelations,
  canEditByProjectId: Record<string, boolean>,
): boolean {
  if (!field.issueTypeIdsHavingField.has(task.issueTypeId)) return false;
  if (!task.projectId) return false;
  return Boolean(canEditByProjectId[task.projectId]);
}

// 행의 이슈 유형 구성표에 이 필드가 포함돼 있는지(값 표시 여부와 무관하게 컬럼 적용 대상인지).
export function isFieldInTaskSchema(field: WorkspaceField, task: WorkItemWithRelations): boolean {
  return field.issueTypeIdsHavingField.has(task.issueTypeId);
}

// 뷰 공용 시스템 편집 셀 게이팅. 권한은 모르면 허용(서버가 최종 강제), 명시적 false 만 차단.
// schemaKey 가 모델에 있으면 행 이슈 유형 구성표 포함 여부도 함께 확인한다(없으면 게이팅 안 함=레거시).
// schemaKey 가 null 이면 필드가 아닌 동작(예: 이슈 유형 선택)이라 프로젝트 편집 권한만 본다.
export function canEditTaskField(
  task: WorkItemWithRelations,
  schemaKey: string | null,
  workspaceFields: WorkspaceField[] | undefined,
  canEditByProjectId: Record<string, boolean> | undefined,
): boolean {
  if (canEditByProjectId && task.projectId) {
    if (canEditByProjectId[task.projectId] === false) return false;
  }
  if (!schemaKey) return true;
  const field = (workspaceFields ?? []).find((entry) => entry.key === schemaKey);
  if (!field) return true;
  return field.issueTypeIdsHavingField.has(task.issueTypeId);
}

// 멀티뷰 커스텀 필드 값을 읽기 전용 칩 텍스트로 직렬화(SELECT/MULTI_SELECT 는 라벨로 해석).
// 값이 없으면 null.
export function formatCustomFieldText(field: WorkspaceField, value: string | string[] | null): string | null {
  if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  const toLabel = (raw: string) => findReferenceOption(field.options, raw)?.label ?? raw;
  if (Array.isArray(value)) return value.map(toLabel).join(", ");
  if (["SELECT", "REFERENCE", "OBJECT_REF", "ENTITY_REF", "USER"].includes(field.type)) return toLabel(value);
  return value;
}

// task.fieldValues 배열 참조 기준 fieldId→value 맵 캐시. 멀티뷰는 한 task 의 여러 커스텀 컬럼/셀에서
// 반복 조회하므로, 배열 참조가 안정적인 동안(React Query 캐시) 맵을 재생성하지 않는다.
const fieldValueMapCache = new WeakMap<object, Map<string, string>>();
const EMPTY_FIELD_VALUE_MAP: Map<string, string> = new Map();

function getCachedFieldValueMap(fieldValues: WorkItemWithRelations["fieldValues"]): Map<string, string> {
  if (!fieldValues || fieldValues.length === 0) return EMPTY_FIELD_VALUE_MAP;
  const cached = fieldValueMapCache.get(fieldValues);
  if (cached) return cached;
  const map = getFieldValueMap(fieldValues);
  fieldValueMapCache.set(fieldValues, map);
  return map;
}

// 커스텀 필드의 저장값을 파싱해 반환(시스템 필드는 호출부에서 task 속성으로 직접 처리).
// SELECT 라벨 해석은 표시 계층에서 field.options 로 수행한다.
export function getTaskCustomFieldValue(
  task: WorkItemWithRelations,
  field: WorkspaceField,
): string | string[] | null {
  const valueMap = getCachedFieldValueMap(task.fieldValues);
  return parseStoredFieldValue(field, valueMap.get(field.id) ?? null);
}
