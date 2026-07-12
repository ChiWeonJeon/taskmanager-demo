import type { ProjectAccess } from "@/lib/project-permissions";
import { hasProjectAccess, hasProjectPermission } from "@/lib/project-permissions";

export type ChecklistPermission =
  | "checklist:read"
  | "checklist:create"
  | "checklist:edit"
  | "checklist:delete"
  | "checklist:manage";

export function canReadChecklist(access: ProjectAccess): boolean {
  if (!hasProjectAccess(access)) return false;
  return (
    access.isAdmin ||
    access.isOwner ||
    hasProjectPermission(access, "checklist:read") ||
    hasProjectPermission(access, "checklist:create") ||
    hasProjectPermission(access, "checklist:edit") ||
    hasProjectPermission(access, "checklist:manage")
  );
}

export function requireChecklistPermission(
  access: ProjectAccess,
  permission: ChecklistPermission
): boolean {
  if (!hasProjectAccess(access)) return false;
  if (access.isAdmin || access.isOwner) return true;
  if (permission === "checklist:read") return canReadChecklist(access);
  return hasProjectPermission(access, permission);
}
