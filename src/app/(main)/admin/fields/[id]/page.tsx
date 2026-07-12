"use client";

import { useParams } from "next/navigation";
import { FieldDetail } from "@/app/(main)/admin/fields/field-detail";

export default function EditFieldPage() {
  const params = useParams<{ id: string }>();
  const fieldId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <FieldDetail mode="edit" fieldId={fieldId} />;
}
