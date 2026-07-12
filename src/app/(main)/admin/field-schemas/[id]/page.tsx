"use client";

import { useParams } from "next/navigation";
import { FieldSchemaEditor } from "@/components/admin/field-schema-editor";

export default function EditFieldSchemaPage() {
  const params = useParams<{ id: string }>();
  const schemaId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <FieldSchemaEditor schemaId={schemaId} />;
}

