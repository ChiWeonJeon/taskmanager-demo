"use client";

import { use } from "react";
import { CyclePageShell } from "@/components/cycle/cycle-page-shell";

export default function ProjectCyclesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <CyclePageShell
      endpoint={`/api/projects/${encodeURIComponent(id)}/cycles`}
      queryKey={["cycles", "project", id]}
      mode="project"
      referenceProjectId={id}
    />
  );
}
