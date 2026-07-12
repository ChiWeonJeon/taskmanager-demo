"use client";

import { useParams } from "next/navigation";
import { GroupDetail } from "@/app/(main)/admin/project-groups/group-detail";

export default function EditProjectGroupPage() {
  const params = useParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <GroupDetail groupId={groupId} />;
}
