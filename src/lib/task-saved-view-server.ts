import { isAdminUser } from "@/lib/admin-access";
import { getGroupAccess, hasGroupAccess } from "@/lib/group-permissions";
import { getProjectAccess, hasProjectAccess } from "@/lib/project-permissions";
import {
  normalizeTaskSavedViewConfig,
  parseTaskSavedViewConfig,
  parseTaskWorkspaceKey,
  type TaskSavedViewConfig,
  type TaskSavedViewDto,
} from "@/lib/task-saved-view";

type SessionUserLike = {
  id?: string | null;
  role?: string | null;
  email?: string | null;
};

type SavedViewRow = {
  id: string;
  workspaceKey: string;
  name: string;
  isShared: boolean;
  isDefault: boolean;
  config: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function normalizeSavedViewName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

export function normalizeSavedViewPayloadConfig(value: unknown): TaskSavedViewConfig {
  return normalizeTaskSavedViewConfig(value);
}

export async function canReadTaskSavedViewWorkspace(workspaceKey: string, user: SessionUserLike) {
  const parsed = parseTaskWorkspaceKey(workspaceKey);
  if (!parsed) return false;
  if (parsed.scope === "my" || parsed.scope === "all") return Boolean(user.id);
  if (parsed.scope === "project") {
    return hasProjectAccess(await getProjectAccess(parsed.id, user));
  }
  return hasGroupAccess(await getGroupAccess(parsed.id, user));
}

export function canManageSavedView(row: { createdById: string | null }, user: SessionUserLike) {
  return isAdminUser(user) || Boolean(user.id && row.createdById === user.id);
}

export function toTaskSavedViewDto(row: SavedViewRow, user: SessionUserLike): TaskSavedViewDto {
  return {
    id: row.id,
    workspaceKey: row.workspaceKey,
    name: row.name,
    isShared: row.isShared,
    isDefault: row.isDefault,
    config: parseTaskSavedViewConfig(row.config),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isOwner: Boolean(user.id && row.createdById === user.id),
    canManage: canManageSavedView(row, user),
  };
}
