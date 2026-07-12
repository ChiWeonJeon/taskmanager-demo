"use client";

import { useParams } from "next/navigation";
import { IssueTypeDetail } from "@/app/(main)/admin/issue-types/issue-type-detail";

export default function EditEntityTypePage() {
  const params = useParams<{ id: string }>();
  const entityTypeId = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <IssueTypeDetail
      mode="edit"
      issueTypeId={entityTypeId}
      apiBase="/api/entity-types"
      listPath="/admin/entity-types"
      queryKey={["entity-types"]}
      messagesKind="entityTypes"
      requireStatusSchema={false}
    />
  );
}
