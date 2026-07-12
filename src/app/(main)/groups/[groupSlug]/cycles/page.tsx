"use client";

import { use } from "react";
import { CyclePageShell } from "@/components/cycle/cycle-page-shell";

export default function GroupCyclesPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = use(params);
  return (
    <CyclePageShell
      endpoint={`/api/project-groups/${encodeURIComponent(groupSlug)}/cycles`}
      queryKey={["cycles", "group", groupSlug]}
      mode="group"
      referenceGroupId={groupSlug}
    />
  );
}
