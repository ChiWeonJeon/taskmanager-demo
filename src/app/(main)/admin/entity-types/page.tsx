"use client";

import { IssueTypesAdminPage } from "@/app/(main)/admin/issue-types/page";

export default function EntityTypesPage() {
  return (
    <IssueTypesAdminPage
      apiBase="/api/entity-types"
      listPath="/admin/entity-types"
      queryKey={["entity-types"]}
      messagesKind="entityTypes"
    />
  );
}
