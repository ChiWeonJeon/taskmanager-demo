import { prisma } from "@/lib/db";
import {
  CANONICAL_FIELD_SCHEMA_ORDER,
  LOCKED_SYSTEM_FIELD_KEY_SET,
  isObjectRecordSchemaFieldType,
  isObjectRecordTitleFieldKey,
  parseFieldOptions,
  resolveObjectSchemaFieldRequired,
  resolveSchemaFieldRequired,
} from "@/lib/field-schema";

export type FieldSchemaUsage = "entity" | "object";

export const fieldSchemaAdminInclude = {
  fields: {
    include: { field: true },
    orderBy: { sortOrder: "asc" as const },
  },
  issueTypes: {
    select: {
      id: true,
      name: true,
    },
  },
  objectDefs: {
    select: {
      id: true,
      key: true,
      name: true,
    },
  },
};

export async function normalizeFieldSchemaFieldIds(
  fieldIds: string[] | undefined,
  usage: FieldSchemaUsage = "entity",
) {
  const requestedIds = Array.from(
    new Set((fieldIds ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  );

  const filters: Array<{ key?: { in: string[] }; id?: { in: string[] } }> = [];

  if (usage === "entity") {
    filters.push({ key: { in: Array.from(LOCKED_SYSTEM_FIELD_KEY_SET) } });
  }

  if (requestedIds.length > 0) {
    filters.push({ id: { in: requestedIds } });
  }

  if (filters.length === 0) return [];

  const fields = await prisma.field.findMany({
    where: { OR: filters },
    orderBy: { createdAt: "asc" },
  });

  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const missingRequestedIds = requestedIds.filter((id) => !fieldsById.has(id));
  if (missingRequestedIds.length > 0) {
    throw new Error("Unknown field ids.");
  }

  if (usage === "object") {
    return requestedIds;
  }

  const lockedFieldIds = CANONICAL_FIELD_SCHEMA_ORDER.flatMap((key) => {
    if (!LOCKED_SYSTEM_FIELD_KEY_SET.has(key)) return [];

    const field = fields.find((item) => item.key === key);
    return field ? [field.id] : [];
  });

  if (lockedFieldIds.length !== LOCKED_SYSTEM_FIELD_KEY_SET.size) {
    throw new Error("Locked system fields are missing.");
  }

  const lockedFieldIdSet = new Set(lockedFieldIds);
  const orderedCustomFieldIds = requestedIds.filter((id) => !lockedFieldIdSet.has(id));

  return [...lockedFieldIds, ...orderedCustomFieldIds];
}

function assertObjectFieldRows(fields: Array<{ key: string; type: string; id: string }>, rows: Array<{ fieldId: string; isRequired: boolean }>) {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  let hasRequiredTitle = false;

  for (const row of rows) {
    const field = fieldsById.get(row.fieldId);
    if (!field) continue;
    if (!isObjectRecordSchemaFieldType(field.type)) {
      throw new Error("Unsupported field type for object record schemas.");
    }
    if (isObjectRecordTitleFieldKey(field.key) && row.isRequired) {
      hasRequiredTitle = true;
    }
  }

  if (!hasRequiredTitle) {
    throw new Error("Object field schema must include a required title field.");
  }
}

// 필드 스키마별 기본값(JSON string)을 필드 타입/옵션 기준으로 정규화한다. 유효하지 않으면 null.
function sanitizeFieldDefault(
  field: { type: string; options: string | null } | undefined,
  raw: string | null | undefined,
) {
  if (!field || raw == null) return null;
  if (typeof raw !== "string" || raw.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (field.type === "SELECT") {
    const allowed = new Set(parseFieldOptions(field.options).map((option) => option.value));
    if (typeof parsed !== "string") return null;
    if (allowed.size > 0 && !allowed.has(parsed)) return null;
    return JSON.stringify(parsed);
  }

  if (["MULTI_SELECT", "MULTI_REFERENCE", "MULTI_OBJECT_REF", "MULTI_ENTITY_REF"].includes(field.type)) {
    if (!Array.isArray(parsed)) return null;
    const allowed = field.type === "MULTI_SELECT"
      ? new Set(parseFieldOptions(field.options).map((option) => option.value))
      : new Set<string>();
    const values = parsed.filter(
      (value): value is string => typeof value === "string" && (allowed.size === 0 || allowed.has(value)),
    );
    return values.length > 0 ? JSON.stringify(values) : null;
  }

  if (typeof parsed !== "string" && typeof parsed !== "number") return null;
  const normalized = String(parsed).trim();
  return normalized ? JSON.stringify(normalized) : null;
}

// fieldIds(순서) + 필드별 기본값/필수 맵을 받아 FieldSchemaField create row 배열로 변환한다.
// isRequired 는 resolveSchemaFieldRequired 단일 규칙으로 채운다(잠금 시스템키는 항상 필수,
// 그 외엔 요청 오버라이드 → Field.isRequired 폴백). 과거에는 미기록으로 편집 시 false 로 유실됐다.
// TODO(ai-followup): [배경] 관리자 에디터 UI 는 아직 per-field 필수 토글을 전송하지 않는다(읽기전용 배지).
// [작업] field-schema-editor.tsx 에 비잠금 필드용 필수 토글을 추가해 fieldRequired 로 전송.
// [테스트] 커스텀 필드 필수 지정 후 생성/서버 검증에서 강제되는지 확인.
export async function normalizeFieldSchemaFieldRows(
  fieldIds: string[] | undefined,
  fieldDefaults?: Record<string, string | null> | null,
  fieldRequired?: Record<string, boolean> | null,
  options?: { usage?: FieldSchemaUsage },
) {
  const usage = options?.usage ?? "entity";
  const orderedIds = await normalizeFieldSchemaFieldIds(fieldIds, usage);
  const fields = await prisma.field.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, key: true, type: true, options: true, isRequired: true },
  });
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  const rows = orderedIds.map((fieldId, index) => {
    const field = fieldsById.get(fieldId);
    return {
      fieldId,
      sortOrder: index,
      isRequired: field
        ? usage === "object"
          ? resolveObjectSchemaFieldRequired(field.key, fieldRequired?.[fieldId], field.isRequired)
          : resolveSchemaFieldRequired(field.key, fieldRequired?.[fieldId], field.isRequired)
        : false,
      defaultValue: sanitizeFieldDefault(field, fieldDefaults?.[fieldId] ?? null),
    };
  });

  if (usage === "object") {
    assertObjectFieldRows(fields, rows);
  }

  return rows;
}
