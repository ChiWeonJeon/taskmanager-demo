"use client";

import { useParams } from "next/navigation";
import { IssueTypeDetail } from "@/app/(main)/admin/issue-types/issue-type-detail";

export default function EditIssueTypePage() {
  const params = useParams<{ id: string }>();
  const issueTypeId = Array.isArray(params.id) ? params.id[0] : params.id;

  return <IssueTypeDetail mode="edit" issueTypeId={issueTypeId} />;
}
