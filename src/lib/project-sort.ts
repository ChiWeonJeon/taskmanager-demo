export interface SortableProject {
  id: string;
  name: string;
  key: string;
  groupId?: string | null;
  sortOrderInGroup?: number;
  createdAt?: string | Date;
}

export interface SortableGroup {
  id: string;
  name: string;
  slug: string;
  createdAt?: string | Date;
}

export interface UserProjectOrderEntry {
  projectId: string;
  sortOrder: number;
}

export interface ProjectGroupBucket<P extends SortableProject> {
  group: SortableGroup | null;
  projects: P[];
}

function toTime(value: string | Date | undefined) {
  if (!value) return 0;
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

export function sortProjectsForUser<P extends SortableProject>(
  projects: P[],
  userOrder: UserProjectOrderEntry[],
): P[] {
  const userMap = new Map(userOrder.map((entry) => [entry.projectId, entry.sortOrder]));
  return [...projects].sort((a, b) => {
    const aUser = userMap.get(a.id);
    const bUser = userMap.get(b.id);
    if (aUser != null && bUser != null) return aUser - bUser;
    if (aUser != null) return -1;
    if (bUser != null) return 1;

    const sameGroup = (a.groupId ?? null) === (b.groupId ?? null);
    if (sameGroup && a.groupId != null) {
      const aOrder = a.sortOrderInGroup ?? 0;
      const bOrder = b.sortOrderInGroup ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    return toTime(a.createdAt) - toTime(b.createdAt);
  });
}

export function groupProjectsByGroup<P extends SortableProject>(
  projects: P[],
  groups: SortableGroup[],
  userOrder: UserProjectOrderEntry[],
): ProjectGroupBucket<P>[] {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const buckets = new Map<string | null, P[]>();

  for (const project of projects) {
    const key = project.groupId ?? null;
    const list = buckets.get(key) ?? [];
    list.push(project);
    buckets.set(key, list);
  }

  const ordered: ProjectGroupBucket<P>[] = [];
  const groupOrder = [...groups].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));

  for (const group of groupOrder) {
    const list = buckets.get(group.id) ?? [];
    ordered.push({
      group,
      projects: sortProjectsForUser(list, userOrder),
    });
    buckets.delete(group.id);
  }

  const ungrouped = buckets.get(null) ?? [];
  if (ungrouped.length > 0 || groups.length === 0) {
    ordered.push({
      group: null,
      projects: sortProjectsForUser(ungrouped, userOrder),
    });
  }

  // Surface any groups that existed as keys without metadata (defensive).
  for (const [groupId, list] of buckets) {
    if (groupId == null) continue;
    const g = groupById.get(groupId);
    if (!g) continue;
    ordered.push({ group: g, projects: sortProjectsForUser(list, userOrder) });
  }

  return ordered;
}
