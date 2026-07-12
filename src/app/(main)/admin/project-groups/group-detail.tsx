"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";

interface AdminProjectGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  _count: { projects: number; members: number };
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface GroupFormState {
  name: string;
  slug: string;
  description: string;
  ownerId: string;
}

function toForm(group: AdminProjectGroup): GroupFormState {
  return {
    name: group.name,
    slug: group.slug,
    description: group.description ?? "",
    ownerId: group.ownerId,
  };
}

// project-groups is edit-only: the admin API exposes GET (list) + PATCH/DELETE
// on [id], but no create route, so there is no `new` mode here.
export function GroupDetail({ groupId }: { groupId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.adminProjectGroupsPage;

  const { data: groups = [], isLoading } = useQuery<AdminProjectGroup[]>({
    queryKey: ["admin-project-groups"],
    queryFn: async () => {
      const res = await fetch("/api/admin/project-groups");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
  });

  const group = groups.find((g) => g.id === groupId);

  const form = useStagedForm<GroupFormState>(
    group ? toForm(group) : { name: "", slug: "", description: "", ownerId: "" },
  );

  const loadedKey = group ? `${group.id}:${group.name}:${group.slug}:${group.description}:${group.ownerId}` : "";
  const syncedRef = useRef("");
  useEffect(() => {
    if (group && syncedRef.current !== loadedKey) {
      syncedRef.current = loadedKey;
      form.reset(toForm(group));
    }
  }, [group, loadedKey, form]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-project-groups"] });
    queryClient.invalidateQueries({ queryKey: ["my-project-groups"] });
  };

  const updateMutation = useMutation({
    mutationFn: async (values: GroupFormState) => {
      const res = await fetch(`/api/admin/project-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          slug: values.slug.trim().toLowerCase(),
          description: values.description.trim() || null,
          ownerId: values.ownerId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || m.updateFailed);
    },
    onSuccess: async (_data, values) => {
      invalidate();
      form.reset(values);
      toast(m.updated, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/project-groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || m.deleteFailed);
      }
    },
    onSuccess: () => {
      invalidate();
      toast(m.deleteButton, { type: "success" });
      router.push("/admin/project-groups");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const isValid = form.values.name.trim().length > 0 && form.values.slug.trim().length > 0 && Boolean(form.values.ownerId);
  const notFound = !isLoading && !group;

  return (
    <AdminDetailShell
      title={m.editTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.pageTitle, href: "/admin/project-groups" },
        { label: m.editTitle },
      ]}
      isDirty={form.isDirty}
      isValid={isValid}
      isSaving={updateMutation.isPending}
      onSave={() => updateMutation.mutate(form.values)}
      onDiscard={() => form.reset()}
      onDelete={group ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={m.deleteConfirm.replace("{name}", form.values.name)}
      deleteConfirmDescription={m.dangerZoneDescription}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={notFound}
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.nameLabel}</span>
            <Input value={form.values.name} onChange={(e) => form.setField("name", e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.slugLabel}</span>
            <Input value={form.values.slug} onChange={(e) => form.setField("slug", e.target.value)} className="font-mono" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.descriptionLabel}</span>
            <Input value={form.values.description} onChange={(e) => form.setField("description", e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.ownerLabel}</span>
            <select
              value={form.values.ownerId}
              onChange={(e) => form.setField("ownerId", e.target.value)}
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </AdminDetailShell>
  );
}
