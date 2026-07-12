"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";

const PERMISSION_KEYS = [
  "project:manage",
  "members:manage",
  "workitems:create",
  "workitems:edit",
  "workitems:delete",
  "workitems:assign",
  "comments:create",
  "comments:delete",
] as const;

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: string;
  _count: { projectMembers: number };
}

interface RoleFormState {
  name: string;
  description: string;
  permissions: string[];
}

function toForm(role: Role): RoleFormState {
  return {
    name: role.name,
    description: role.description ?? "",
    permissions: JSON.parse(role.permissions) as string[],
  };
}

interface RoleDetailProps {
  mode: "new" | "edit";
  roleId?: string;
}

export function RoleDetail({ mode, roleId }: RoleDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.admin.roles;
  const pageMsg = messages.adminRolesPage;
  const permissionLabels = messages.permissions;

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error(pageMsg.loadFailed);
      return res.json() as Promise<Role[]>;
    },
    enabled: mode === "edit",
  });

  const role = mode === "edit" ? roles.find((r) => r.id === roleId) : undefined;
  const isSystem = Boolean(role?.isSystem);

  const form = useStagedForm<RoleFormState>(
    mode === "edit" && role ? toForm(role) : { name: "", description: "", permissions: [] },
  );

  // Re-sync the staged baseline once the role loads (edit mode).
  const loadedKey = role ? `${role.id}:${role.permissions}:${role.name}:${role.description}` : "";
  const syncedRef = useRef("");
  useEffect(() => {
    if (role && syncedRef.current !== loadedKey) {
      syncedRef.current = loadedKey;
      form.reset(toForm(role));
    }
  }, [role, loadedKey, form]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-roles"] });

  const createMutation = useMutation({
    mutationFn: async (values: RoleFormState) => {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || pageMsg.createFailed);
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.created, { type: "success" });
      router.push("/admin/roles");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: RoleFormState) => {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || pageMsg.updateFailed);
      }
    },
    onSuccess: async (_data, values) => {
      await invalidate();
      form.reset(values);
      toast(m.updated, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || pageMsg.updateFailed);
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.setDefaultSuccess, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/roles/${roleId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || pageMsg.deleteFailed);
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.deleted, { type: "success" });
      router.push("/admin/roles");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  function togglePermission(key: string) {
    form.setValues((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((p) => p !== key)
        : [...current.permissions, key],
    }));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isValid = form.values.name.trim().length > 0;
  const readOnly = mode === "edit" && (isSystem || (!isLoading && !role));

  return (
    <AdminDetailShell
      title={mode === "new" ? m.create : m.editTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title, href: "/admin/roles" },
        { label: mode === "new" ? m.create : m.editTitle },
      ]}
      isDirty={form.isDirty}
      isValid={isValid}
      isSaving={isSaving}
      onSave={() =>
        mode === "new"
          ? createMutation.mutate(form.values)
          : updateMutation.mutate(form.values)
      }
      onDiscard={() => form.reset()}
      onDelete={mode === "edit" && !isSystem && role ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={m.confirmDelete}
      deleteConfirmDescription={messages.adminCommon.confirmDeleteBody}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={readOnly}
    >
      {mode === "edit" && !isLoading && !role ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : (
        <div className="space-y-5">
          {isSystem && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
              {m.systemHint}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {m.name}
              </span>
              <Input
                value={form.values.name}
                onChange={(e) => form.setField("name", e.target.value)}
                placeholder={m.namePlaceholder}
                disabled={readOnly}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {m.description_}
              </span>
              <Input
                value={form.values.description}
                onChange={(e) => form.setField("description", e.target.value)}
                placeholder={m.descriptionPlaceholder}
                disabled={readOnly}
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
              {m.permissions}
            </p>
            <div className="flex flex-wrap gap-2">
              {PERMISSION_KEYS.map((key) => {
                const active = form.values.permissions.includes(key);
                const label =
                  permissionLabels[key as keyof typeof permissionLabels] ?? key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={readOnly}
                    onClick={() => togglePermission(key)}
                    className={`inline-flex items-center rounded-[var(--radius-full)] border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-tertiary)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "edit" && role && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                      {m.defaultBadge}
                    </span>
                    {role.isDefault && (
                      <span className="inline-flex items-center rounded-[var(--radius-full)] border border-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-0.5 text-[length:var(--text-2xs)] font-medium text-[var(--color-accent)]">
                        {m.defaultBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{m.defaultHint}</p>
                </div>
                {!role.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultMutation.mutate()}
                    disabled={setDefaultMutation.isPending}
                    className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
                  >
                    {m.setDefault}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminDetailShell>
  );
}
