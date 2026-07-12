import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  isEntityReferenceFieldType,
  isMultiValueFieldType,
  isObjectReferenceFieldType,
  isOptionFieldType,
  isReferenceFieldType,
  parseFieldOptions,
} from "@/lib/objects/field-kinds";

type DbClient = Prisma.TransactionClient | typeof prisma;

const ALLOWED_FIELD_TYPES = new Set([
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "URL",
  "REFERENCE",
  "MULTI_REFERENCE",
  "OBJECT_REF",
  "MULTI_OBJECT_REF",
  "ENTITY_REF",
  "MULTI_ENTITY_REF",
  "USER",
]);

export interface FieldOptionInput {
  value: string;
  label: string;
  color?: string | null;
}

export function normalizeFieldType(rawType: string) {
  const type = rawType.trim();
  if (!ALLOWED_FIELD_TYPES.has(type)) {
    throw new Error("Unsupported field type.");
  }
  return type;
}

export function normalizeOptions(type: string, rawOptions: unknown) {
  if (!isOptionFieldType(type)) return null;
  if (rawOptions == null) return null;
  if (!Array.isArray(rawOptions)) {
    throw new Error("Options must be an array.");
  }

  const normalized = rawOptions
    .filter((option): option is FieldOptionInput => (
      typeof option === "object"
      && option !== null
      && typeof (option as FieldOptionInput).value === "string"
      && typeof (option as FieldOptionInput).label === "string"
    ))
    .map((option) => ({
      value: option.value.trim(),
      label: option.label.trim(),
      color: option.color?.trim() || null,
    }))
    .filter((option) => option.value && option.label);

  return normalized;
}

export function parseStoredOptions(rawOptions: string | null | undefined) {
  return parseFieldOptions(rawOptions).map((option) => ({
    value: option.value,
    label: option.label,
    color: option.color ?? null,
  }));
}

export function normalizeDefaultValue(type: string, options: FieldOptionInput[] | null, rawDefaultValue: unknown) {
  if (rawDefaultValue == null || rawDefaultValue === "") return null;

  if (type === "SELECT" || (isReferenceFieldType(type) && !isMultiValueFieldType(type))) {
    if (typeof rawDefaultValue !== "string") {
      throw new Error(`Default value must be a string for ${type} fields.`);
    }

    const value = rawDefaultValue.trim();
    if (!value) return null;

    if (type === "SELECT" && options && options.length > 0 && !options.some((option) => option.value === value)) {
      throw new Error("Default value must reference an existing option.");
    }

    return JSON.stringify(value);
  }

  if (isMultiValueFieldType(type)) {
    if (!Array.isArray(rawDefaultValue)) {
      throw new Error(`Default value must be an array for ${type} fields.`);
    }

    const values = rawDefaultValue
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);

    if (type === "MULTI_SELECT" && options && options.length > 0 && values.some((value) => !options.some((option) => option.value === value))) {
      throw new Error("Default value must reference existing options.");
    }

    return values.length > 0 ? JSON.stringify(values) : null;
  }

  throw new Error("Default values are only supported for select and reference fields.");
}

export async function normalizeReferenceObjectKey(
  client: DbClient,
  type: string,
  rawReferenceObjectKey: unknown,
) {
  if (!isReferenceFieldType(type) || type === "USER") return null;

  const key = typeof rawReferenceObjectKey === "string" ? rawReferenceObjectKey.trim() : "";
  if (!key) {
    throw new Error("Reference target is required.");
  }

  if (isEntityReferenceFieldType(type)) {
    const entityType = await client.issueType.findFirst({
      where: {
        deletedAt: null,
        OR: [{ key }, { category: key.toUpperCase() }],
      },
      select: { key: true, category: true },
    });
    const targetKey = entityType?.key ?? entityType?.category.toLowerCase() ?? null;
    if (!targetKey) {
      throw new Error("Entity reference target is invalid.");
    }
    return targetKey;
  }

  if (isObjectReferenceFieldType(type)) {
    const objectDef = await client.objectDef.findFirst({
      where: { key, deletedAt: null },
      select: { key: true },
    });
    if (!objectDef) {
      throw new Error("Reference object is invalid.");
    }
    return objectDef.key;
  }

  return key;
}

export async function resolveReferenceObjectDefId(
  client: DbClient,
  type: string,
  referenceObjectKey: string | null,
) {
  if (!isObjectReferenceFieldType(type) || !referenceObjectKey) return null;

  const objectDef = await client.objectDef.findFirst({
    where: { key: referenceObjectKey, deletedAt: null },
    select: { id: true },
  });
  if (!objectDef) {
    throw new Error("Reference object is invalid.");
  }

  return objectDef.id;
}
