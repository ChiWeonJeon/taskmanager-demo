"use client";

import { useParams } from "next/navigation";
import { ReferenceObjectDetail } from "@/app/(main)/admin/reference-objects/reference-object-detail";

export default function EditReferenceObjectPage() {
  const params = useParams<{ key: string }>();
  const objectKey = Array.isArray(params.key) ? params.key[0] : params.key;

  return <ReferenceObjectDetail mode="edit" objectKey={objectKey} />;
}
