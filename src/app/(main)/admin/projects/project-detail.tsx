"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/locale-provider";

interface AdminProject {
  id: string;
  name: string;
  key: string;
  description: string | null;
  isPersonal: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  workItemCount: number;
  owner: { id: string; name: string; email: string } | null;
}

// projects admin is read-only here: the admin API exposes GET only, and project
// edits live at /projects/[key]/admin. So the detail is a readOnly AdminDetailShell
// (no save bar) that surfaces the record and links to the editable surfaces.
export function ProjectDetail({ projectId }: { projectId: string }) {
  const { messages } = useI18n();
  const m = messages.adminProjectsPage;

  const { data: projects = [], isLoading } = useQuery<AdminProject[]>({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const res = await fetch("/api/admin/projects");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
  });

  const project = projects.find((p) => p.id === projectId);
  const notFound = !isLoading && !project;

  return (
    <AdminDetailShell
      title={project ? project.name : m.detailTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title, href: "/admin/projects" },
        { label: project?.name ?? m.detailTitle },
      ]}
      isDirty={false}
      isValid
      isSaving={false}
      onSave={() => {}}
      onDiscard={() => {}}
      readOnly
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : project ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
              {project.key}
            </span>
            <Badge variant={project.isPersonal ? "default" : "accent"}>
              {project.isPersonal ? m.personalBadge : m.sharedBadge}
            </Badge>
          </div>

          {project.description && (
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{project.description}</p>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            <ReadField label={m.colKey} value={project.key} />
            <ReadField label={m.colOwner} value={project.owner ? `${project.owner.name} (${project.owner.email})` : messages.commonUi.unassigned} />
            <ReadField label={m.colMembers} value={String(project.memberCount)} />
            <ReadField label={m.colIssues} value={String(project.workItemCount)} />
          </dl>

          <div className="flex items-center gap-2 pt-2">
            <Link href={`/projects/${project.key}/today`}>
              <Button variant="secondary" size="sm">{m.open}</Button>
            </Link>
            <Link href={`/projects/${project.key}/admin`}>
              <Button variant="ghost" size="sm">{m.admin}</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </AdminDetailShell>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
      <p className="text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
