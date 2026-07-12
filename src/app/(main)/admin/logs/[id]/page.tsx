"use client";

import { useParams } from "next/navigation";
import { LogDetail } from "@/app/(main)/admin/logs/log-detail";

export default function AdminLogDetailPage() {
  const params = useParams<{ id: string }>();
  const logId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <LogDetail logId={logId} />;
}
