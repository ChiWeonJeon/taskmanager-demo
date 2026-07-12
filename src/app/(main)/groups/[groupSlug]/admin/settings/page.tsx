"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/shared/locale-provider";

interface GroupDetail {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    ownerId: string;
  };
  canManage: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function GroupSettingsPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { messages } = useI18n();
  const base = messages.groupAdminPage;
  const m = base.settings;

  const { data } = useQuery<GroupDetail>({
    queryKey: ["project-group", groupSlug],
    queryFn: async () => {
      const res = await fetch(`/api/project-groups/${groupSlug}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Controlled form state — derived with overrides so we don't need useEffect(setState)
  const [overrides, setOverrides] = useState<{
    name?: string;
    slug?: string;
    description?: string;
    ownerId?: string;
  }>({});
  const name = overrides.name ?? data?.group.name ?? "";
  const slug = overrides.slug ?? data?.group.slug ?? "";
  const description = overrides.description ?? data?.group.description ?? "";
  const ownerId = overrides.ownerId ?? data?.group.ownerId ?? "";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOwnerTransfer, setPendingOwnerTransfer] = useState<{
    nextOwner: User;
  } | null>(null);

  // Filter out current owner from transfer target candidates.
  const transferCandidates = useMemo(() => {
    if (!data?.group.ownerId) return users;
    return users.filter((u) => u.id !== data.group.ownerId);
  }, [users, data?.group.ownerId]);

  if (!data) return <div className="h-32 rounded bg-[var(--color-bg-tertiary)] animate-pulse" />;
  if (!data.canManage) {
    return <p className="text-sm text-[var(--color-danger)]">{base.noPermission}</p>;
  }

  const ownerChanged = ownerId !== data.group.ownerId && ownerId !== "";
  const canTransferOwner = data.isOwner || data.isAdmin;

  async function submitPatch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/project-groups/${groupSlug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? m.updateFailed);
        return false;
      }
      queryClient.invalidateQueries({ queryKey: ["project-group", groupSlug] });
      queryClient.invalidateQueries({ queryKey: ["my-project-groups"] });
      setOverrides({});
      if (payload.slug && payload.slug !== groupSlug) {
        router.replace(`/groups/${payload.slug}/admin/settings`);
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  function onSaveClick() {
    if (!data) return;
    // If owner is being transferred, require explicit confirmation via dialog.
    if (ownerChanged && canTransferOwner) {
      const nextOwner = users.find((u) => u.id === ownerId);
      if (!nextOwner) {
        setError(m.transferMissingUser);
        return;
      }
      setPendingOwnerTransfer({ nextOwner });
      return;
    }
    void submitPatch({ name, slug, description });
  }

  async function confirmOwnerTransfer() {
    if (!pendingOwnerTransfer) return;
    const ok = await submitPatch({ name, slug, description, ownerId });
    if (ok) setPendingOwnerTransfer(null);
  }

  async function remove() {
    if (!confirm(m.deleteConfirm.replace("{name}", data?.group.name ?? ""))) return;
    const res = await fetch(`/api/project-groups/${groupSlug}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json();
      setError(payload.error ?? m.deleteFailed);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["my-project-groups"] });
    router.push("/groups");
  }

  const currentOwner = users.find((u) => u.id === data.group.ownerId);

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">{m.heading}</h2>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{m.nameLabel}</span>
          <Input value={name} onChange={(e) => setOverrides((prev) => ({ ...prev, name: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{m.slugLabel}</span>
          <Input value={slug} onChange={(e) => setOverrides((prev) => ({ ...prev, slug: e.target.value }))} />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{m.descriptionLabel}</span>
          <Input value={description} onChange={(e) => setOverrides((prev) => ({ ...prev, description: e.target.value }))} />
        </label>
        <div className="border-t border-[var(--color-border)] pt-3 mt-1">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">{m.currentOwner}</div>
          <div className="text-sm mb-2">
            {currentOwner ? (
              <>
                {currentOwner.name}{" "}
                <span className="text-xs text-[var(--color-text-tertiary)]">({currentOwner.email})</span>
              </>
            ) : (
              <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
            )}
          </div>
          {canTransferOwner && transferCandidates.length > 0 && (
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)]">{m.transferToAnother}</span>
              <select
                value={ownerChanged ? ownerId : ""}
                onChange={(e) => setOverrides((prev) => ({ ...prev, ownerId: e.target.value || data.group.ownerId }))}
                className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-sm"
              >
                <option value="">{m.keepOwnerOption}</option>
                {transferCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                {m.ownerHint}
              </p>
            </label>
          )}
          {canTransferOwner && transferCandidates.length === 0 && (
            <p className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
              {m.noTransferCandidates}
            </p>
          )}
        </div>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        <div className="flex justify-end">
          <Button size="sm" onClick={onSaveClick} disabled={saving}>
            {saving ? m.savingLabel : ownerChanged ? m.saveAndTransfer : m.save}
          </Button>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 space-y-2">
        <h3 className="text-sm font-semibold">{m.cycleInheritanceHeading}</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {m.cycleInheritanceDescription}
        </p>
        <Link
          href={`/groups/${encodeURIComponent(groupSlug)}/cycles`}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-[length:var(--text-xs)] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
        >
          {m.cycleInheritanceButton}
        </Link>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[var(--color-danger-light)]0/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--color-danger)]">{m.dangerZoneHeading}</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {m.dangerZoneDescription}
        </p>
        <Button variant="danger" size="sm" onClick={remove}>
          {m.deleteButton}
        </Button>
      </div>

      {pendingOwnerTransfer && (
        <ConfirmDialog
          open
          title={m.transferDialogTitle}
          description={
            <>
              {m.transferDialogBodyPrefix} <strong>{data.group.name}</strong> {m.transferDialogBodyTo}{" "}
              <strong>{pendingOwnerTransfer.nextOwner.name} ({pendingOwnerTransfer.nextOwner.email})</strong>
              <br />
              {m.transferDialogHint}
              {error ? <><br />{error}</> : null}
            </>
          }
          confirmLabel={saving ? m.transferDialogConfirming : m.transferDialogConfirm}
          cancelLabel={m.transferDialogCancel}
          busy={saving}
          onConfirm={confirmOwnerTransfer}
          onCancel={() => setPendingOwnerTransfer(null)}
        />
      )}
    </div>
  );
}
