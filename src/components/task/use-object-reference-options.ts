"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { IssueTypeField } from "@/components/task/types";
import type { ReferenceLikeOption } from "@/lib/reference-options";

export type ReferenceOption = ReferenceLikeOption;
type ReferenceTargetMode = "object" | "entity" | "system" | "legacy";
interface ReferenceTarget {
  key: string;
  mode: ReferenceTargetMode;
}

interface EntityRecordReferenceOption {
  id: string;
  title?: string | null;
  recordKey?: string | null;
  sourceId?: string | null;
}

function getEntityRecordReferenceLabel(key: string, record: EntityRecordReferenceOption) {
  if (key === "cycle") return record.title?.trim() || "";
  return record.title ? `${record.recordKey ?? record.id} ${record.title}` : record.recordKey ?? record.id;
}

export function isSingleReferenceField(field: Pick<IssueTypeField, "type">) {
  return field.type === "REFERENCE" || field.type === "OBJECT_REF" || field.type === "ENTITY_REF" || field.type === "USER";
}

export function isMultiReferenceField(field: Pick<IssueTypeField, "type">) {
  return field.type === "MULTI_REFERENCE" || field.type === "MULTI_OBJECT_REF" || field.type === "MULTI_ENTITY_REF";
}

export function getReferenceObjectKey(field: Pick<IssueTypeField, "type" | "referenceObjectKey">) {
  if (field.type === "USER") return "user";
  return field.referenceObjectKey ?? "";
}

export function useObjectReferenceOptions(fields: IssueTypeField[], projectId?: string | null, groupId?: string | null) {
  const targets = useMemo(
    () => {
      const deduped = new Map<string, ReferenceTarget>();
      for (const field of fields) {
        if (!isSingleReferenceField(field) && !isMultiReferenceField(field)) continue;
        const key = getReferenceObjectKey(field);
        if (!key) continue;
        const mode: ReferenceTargetMode = field.type === "ENTITY_REF" || field.type === "MULTI_ENTITY_REF"
          ? "entity"
          : field.type === "USER"
            ? "system"
            : field.type === "REFERENCE" || field.type === "MULTI_REFERENCE"
              ? "legacy"
              : "object";
        deduped.set(`${mode}:${key}`, { key, mode });
      }
      return Array.from(deduped.values()).sort((left, right) => `${left.mode}:${left.key}`.localeCompare(`${right.mode}:${right.key}`));
    },
    [fields],
  );

  return useQuery<Record<string, ReferenceOption[]>>({
    queryKey: ["object-reference-options", projectId ?? "", groupId ?? "", targets],
    enabled: targets.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(targets.map(async ({ key, mode }) => {
        const params = new URLSearchParams();
        if (projectId) params.set("projectId", projectId);
        if (groupId) params.set("groupId", groupId);
        let response: Response;
        if (mode === "object") {
          response = await fetch(`/api/reference-objects/${encodeURIComponent(key)}/records?${params.toString()}`);
        } else if (mode === "entity") {
          params.set("type", key);
          params.set("fields", "id,recordKey,title,sourceId");
          response = await fetch(`/api/entity-records?${params.toString()}`);
        } else {
          response = await fetch(`/api/object-types/${encodeURIComponent(key)}/instances?${params.toString()}`);
        }
        if (!response.ok) return [key, []] as const;
        const body = await response.json() as { instances?: ReferenceOption[]; records?: ReferenceOption[] } | EntityRecordReferenceOption[];
        if (Array.isArray(body)) {
          return [key, body.map((record) => ({
            value: record.id,
            label: getEntityRecordReferenceLabel(key, record),
            aliases: record.sourceId && record.sourceId !== record.id ? [record.sourceId] : undefined,
          }))] as const;
        }
        return [key, body.records ?? body.instances ?? []] as const;
      }));
      return Object.fromEntries(entries);
    },
  });
}
