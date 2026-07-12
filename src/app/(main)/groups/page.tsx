"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { CreateGroupModal } from "@/components/group/create-group-modal";
import { useI18n } from "@/components/shared/locale-provider";

interface ProjectGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
}

export default function GroupsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { messages } = useI18n();
  const m = messages.groupsPage;
  const [createOpen, setCreateOpen] = useState(false);

  const { data: groups = [], isLoading } = useQuery<ProjectGroup[]>({
    queryKey: ["my-project-groups"],
    queryFn: async () => {
      const res = await fetch("/api/project-groups?memberId=me");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: !!session?.user,
  });

  return (
    <div data-service-page="groups" className="min-w-0 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{m.title}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {m.description}
          </p>
        </div>
        {session?.user && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            {m.createButton}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-[var(--radius-lg)] bg-[var(--color-bg-tertiary)] animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-tertiary)]">{m.emptyTitle}</p>
          {session?.user && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{m.emptyDescription}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((group) => (
            <div
              key={group.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/groups/${group.slug}/today`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/groups/${group.slug}/today`);
                }
              }}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-[length:var(--text-2xs)] font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
                  {group.slug}
                </span>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{group.name}</h2>
              </div>
              {group.description && (
                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-2">{group.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateGroupModal
          onClose={() => setCreateOpen(false)}
          onCreated={(group) => {
            queryClient.invalidateQueries({ queryKey: ["my-project-groups"] });
            setCreateOpen(false);
            router.push(`/groups/${group.slug}/today`);
          }}
        />
      )}
    </div>
  );
}
