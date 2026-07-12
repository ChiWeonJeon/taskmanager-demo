"use client";

import { useParams } from "next/navigation";
import { MemberDetail } from "@/app/(main)/admin/project-members/member-detail";

export default function EditProjectMemberPage() {
  const params = useParams<{ id: string }>();
  const memberId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <MemberDetail mode="edit" memberId={memberId} />;
}
