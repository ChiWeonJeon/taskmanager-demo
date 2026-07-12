"use client";

import { useParams } from "next/navigation";
import { StatusSchemaDetail } from "@/app/(main)/admin/status-schemas/status-schema-detail";

export default function EditStatusSchemaPage() {
  const params = useParams<{ id: string }>();
  const schemaId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <StatusSchemaDetail mode="edit" schemaId={schemaId} />;
}
