"use client";

import { useParams } from "next/navigation";
import { ProjectDetail } from "@/app/(main)/admin/projects/project-detail";

export default function AdminProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <ProjectDetail projectId={projectId} />;
}
