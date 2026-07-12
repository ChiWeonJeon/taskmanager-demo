import type { ProjectAccess } from "@/lib/project-permissions";
import { hasProjectAccess, hasProjectPermission } from "@/lib/project-permissions";

export type CyclePermission =
  | "cycle:read"
  | "cycle:create"
  | "cycle:edit"
  | "cycle:delete"
  | "cycle:manage";

export function canReadCycle(access: ProjectAccess): boolean {
  if (!hasProjectAccess(access)) return false;
  return (
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "cycle:read") ||
    hasProjectPermission(access, "cycle:create") ||
    hasProjectPermission(access, "cycle:edit") ||
    hasProjectPermission(access, "cycle:manage")
  );
}

export function requireCyclePermission(access: ProjectAccess, permission: CyclePermission): boolean {
  if (!hasProjectAccess(access)) return false;
  if (access.isAdmin || access.isOwner) return true;
  if (permission === "cycle:read") return canReadCycle(access);
  return hasProjectPermission(access, permission);
}
