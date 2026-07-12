"use client";

import { useParams } from "next/navigation";
import { StatusDetail } from "@/app/(main)/admin/statuses/status-detail";

export default function EditStatusPage() {
  const params = useParams<{ id: string }>();
  const statusId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <StatusDetail mode="edit" statusId={statusId} />;
}
