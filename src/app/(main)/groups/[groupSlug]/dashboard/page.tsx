"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/shared/locale-provider";

interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sortOrderInGroup: number;
}

interface GroupDetail {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    ownerId: string;
    createdAt: string;
  };
  projects: Project[];
  isOwner: boolean;
  isAdmin: boolean;
  canManage: boolean;
  permissions: string[];
}

export default function GroupDashboard({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = use(params);
  const { messages } = useI18n();
  const m = messages.groupDashboard;

  const { data, isLoading } = useQuery<GroupDetail>({
    queryKey: ["project-group", groupSlug],
    queryFn: async () => {
      const res = await fetch(`/api/project-groups/${groupSlug}`);
      if (!res.ok) throw new Error("Failed to load group");
      return res.json();
    },
  });

  if (isLoading || !data) {
    return <div className="h-32 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />;
  }

  return (
    <div className="min-w-0 w-full space-y-4">
      {data.group.description && (
        <p className="text-sm text-[var(--color-text-secondary)]">{data.group.description}</p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {m.memberProjects.replace("{count}", String(data.projects.length))}
        </h2>
        {data.projects.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)] py-8 text-center rounded border border-dashed border-[var(--color-border)]">
            {m.emptyProjects}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.key}/today`}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[length:var(--text-2xs)] font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
                    {project.key}
                  </span>
                  <span className="text-sm font-medium truncate">{project.name}</span>
                </div>
                {project.description && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-1">{project.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
