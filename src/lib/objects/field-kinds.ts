export interface FieldKindDefinition {
  name: string;
  type: string;
  options?: string | null;
}

export interface ParsedFieldOption {
  value: string;
  label: string;
  color?: string | null;
}

const MULTI_VALUE_FIELD_TYPES = new Set(["MULTI_SELECT", "MULTI_REFERENCE", "MULTI_OBJECT_REF", "MULTI_ENTITY_REF"]);
const OPTION_FIELD_TYPES = new Set(["SELECT", "MULTI_SELECT"]);
const OBJECT_REFERENCE_FIELD_TYPES = new Set(["REFERENCE", "MULTI_REFERENCE", "OBJECT_REF", "MULTI_OBJECT_REF"]);
const ENTITY_REFERENCE_FIELD_TYPES = new Set(["ENTITY_REF", "MULTI_ENTITY_REF"]);
const REFERENCE_FIELD_TYPES = new Set([
  "REFERENCE",
  "MULTI_REFERENCE",
  "USER",
  "OBJECT_REF",
  "MULTI_OBJECT_REF",
  "ENTITY_REF",
  "MULTI_ENTITY_REF",
]);

export function isMultiValueFieldType(type: string) {
  return MULTI_VALUE_FIELD_TYPES.has(type);
}

export function isReferenceFieldType(type: string) {
  return REFERENCE_FIELD_TYPES.has(type);
}

export function isObjectReferenceFieldType(type: string) {
  return OBJECT_REFERENCE_FIELD_TYPES.has(type);
}

export function isEntityReferenceFieldType(type: string) {
  return ENTITY_REFERENCE_FIELD_TYPES.has(type);
}

export function isOptionFieldType(type: string) {
  return OPTION_FIELD_TYPES.has(type);
}

export function parseFieldOptions(rawOptions: string | null | undefined) {
  if (!rawOptions) return [] as ParsedFieldOption[];

  try {
    const parsed = JSON.parse(rawOptions) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is ParsedFieldOption => (
      typeof item === "object"
      && item !== null
      && typeof (item as ParsedFieldOption).value === "string"
      && typeof (item as ParsedFieldOption).label === "string"
    ));
  } catch {
    return [];
  }
}

export function parseStoredFieldValue(field: Pick<FieldKindDefinition, "type">, value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (isMultiValueFieldType(field.type)) {
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    }
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
}

export function hasFieldInputValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "number") return true;
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeFieldValueForStorage(field: FieldKindDefinition, value: unknown): string | null {
  if (!hasFieldInputValue(value)) return null;

  if (isMultiValueFieldType(field.type)) {
    if (!Array.isArray(value)) {
      throw new Error(`${field.name} must be an array.`);
    }

    const normalizedValues = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!normalizedValues.length) return null;

    if (field.type === "MULTI_SELECT") {
      const allowedValues = new Set(parseFieldOptions(field.options).map((option) => option.value));
      if (allowedValues.size > 0 && normalizedValues.some((item) => !allowedValues.has(item))) {
        throw new Error(`${field.name} contains an invalid option.`);
      }
    }

    return JSON.stringify(normalizedValues);
  }

  if (Array.isArray(value)) {
    throw new Error(`${field.name} accepts a single value.`);
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${field.name} has an invalid value.`);
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) return null;

  if (field.type === "NUMBER" && Number.isNaN(Number(normalizedValue))) {
    throw new Error(`${field.name} must be a number.`);
  }

  if (field.type === "DATE" && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new Error(`${field.name} must use YYYY-MM-DD.`);
  }

  if (field.type === "SELECT") {
    const allowedValues = new Set(parseFieldOptions(field.options).map((option) => option.value));
    if (allowedValues.size > 0 && !allowedValues.has(normalizedValue)) {
      throw new Error(`${field.name} contains an invalid option.`);
    }
  }

  return JSON.stringify(normalizedValue);
}
