"use client";

import { IssueTypeDetail } from "@/app/(main)/admin/issue-types/issue-type-detail";

export default function NewEntityTypePage() {
  return (
    <IssueTypeDetail
      mode="new"
      apiBase="/api/entity-types"
      listPath="/admin/entity-types"
      queryKey={["entity-types"]}
      messagesKind="entityTypes"
      requireStatusSchema={false}
    />
  );
}
