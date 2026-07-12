"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/locale-provider";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/task/task-icons";

interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  groupId: string | null;
  sortOrderInGroup: number;
}

interface GroupDetail {
  group: { id: string; slug: string };
  projects: Project[];
}

export default function GroupProjectsAdmin({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = use(params);
  const queryClient = useQueryClient();
  const { messages } = useI18n();
  const m = messages.groupAdminPage.projects;

  const { data } = useQuery<GroupDetail>({
    queryKey: ["project-group", groupSlug],
    queryFn: async () => {
      const res = await fetch(`/api/project-groups/${groupSlug}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects?memberId=me");
      return res.ok ? res.json() : [];
    },
  });

  const [overrideOrder, setOverrideOrder] = useState<Project[] | null>(null);
  const localOrder = overrideOrder ?? data?.projects ?? [];
  const setLocalOrder = setOverrideOrder;

  const [addProjectId, setAddProjectId] = useState("");

  const groupProjectIds = new Set(localOrder.map((p) => p.id));
  const addable = allProjects.filter((p) => !groupProjectIds.has(p.id) && !p.groupId);

  async function addProject() {
    if (!addProjectId) return;
    await fetch(`/api/project-groups/${groupSlug}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: addProjectId }),
    });
    queryClient.invalidateQueries({ queryKey: ["project-group", groupSlug] });
    queryClient.invalidateQueries({ queryKey: ["my-projects"] });
    setAddProjectId("");
  }

  async function removeProject(projectId: string) {
    if (!confirm(m.removeConfirm)) return;
    await fetch(`/api/project-groups/${groupSlug}/projects/${projectId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["project-group", groupSlug] });
    queryClient.invalidateQueries({ queryKey: ["my-projects"] });
  }

  function move(index: number, delta: number) {
    const next = [...localOrder];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLocalOrder(next);
  }

  async function saveOrder() {
    await fetch(`/api/project-groups/${groupSlug}/projects/order`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: localOrder.map((p) => p.id) }),
    });
    queryClient.invalidateQueries({ queryKey: ["project-group", groupSlug] });
  }

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">{m.addHeading}</h2>
        <div className="flex gap-2">
          <select
            value={addProjectId}
            onChange={(e) => setAddProjectId(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-sm"
          >
            <option value="">{m.selectPlaceholder}</option>
            {addable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} — {p.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addProject} disabled={!addProjectId}>
            {m.addSubmit}
          </Button>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{m.orderHeading}</h2>
          <Button size="sm" onClick={saveOrder}>
            {m.saveOrder}
          </Button>
        </div>
        {localOrder.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">{m.emptyList}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {localOrder.map((project, index) => (
              <li key={project.id} className="flex items-center gap-2 py-2">
                <span className="shrink-0 text-[length:var(--text-2xs)] font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
                  {project.key}
                </span>
                <span className="truncate flex-1">{project.name}</span>
                <Button variant="ghost" size="sm" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUpIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => move(index, 1)} disabled={index === localOrder.length - 1}>
                  <ArrowDownIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeProject(project.id)}>
                  {m.removeButton}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
