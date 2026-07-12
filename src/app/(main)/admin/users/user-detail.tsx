"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateDisplay } from "@/components/shared/date-display";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
interface ResetLinkResult {
  url: string;
  expiresAt: string;
  email: string;
}

export function UserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.admin.users;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json() as Promise<User[]>;
    },
  });

  const user = users.find((u) => u.id === userId);
  const isSelf = session?.user?.id === userId;
  const form = useStagedForm<{ role: string }>({ role: "USER" });

  const syncedRef = useRef("");
  useEffect(() => {
    if (user && syncedRef.current !== `${user.id}:${user.role}`) {
      syncedRef.current = `${user.id}:${user.role}`;
      form.reset({ role: user.role });
    }
  }, [user, form]);

  const updateMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || messages.adminUsersPage.roleChangeFailed);
      }
    },
    onSuccess: async (_d, role) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      form.reset({ role });
      toast(m.updated, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || messages.adminUsersPage.deleteFailed);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast(m.delete, { type: "success" });
      router.push("/admin/users");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const [resetLink, setResetLink] = useState<ResetLinkResult | null>(null);
  const [resetting, setResetting] = useState(false);
  const generateResetLink = async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/password-reset`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast(body?.error || m.resetLinkError, { type: "error", sticky: true });
        return;
      }
      setResetLink({ url: body.url, expiresAt: body.expiresAt, email: body.email });
    } finally {
      setResetting(false);
    }
  };
  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.url);
      toast(m.resetLinkCopied, { type: "success" });
    } catch {
      toast(m.resetLinkError, { type: "error" });
    }
  };

  const notFound = !isLoading && !user;
  const readOnly = isSelf || notFound;

  return (
    <AdminDetailShell
      title={user ? user.name : m.editTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title, href: "/admin/users" },
        { label: user?.name ?? m.editTitle },
      ]}
      isDirty={form.isDirty}
      isValid
      isSaving={updateMutation.isPending}
      onSave={() => updateMutation.mutate(form.values.role)}
      onDiscard={() => form.reset()}
      onDelete={!isSelf && user ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={m.confirmDelete}
      deleteConfirmDescription={m.dangerZoneDescription}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={readOnly}
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : user ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadField label={m.name} value={user.name} />
            <ReadField label={m.email} value={user.email} />
            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
              <p className="text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">{m.createdAt}</p>
              <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"><DateDisplay date={user.createdAt} format="compact" /></p>
            </div>
          </div>

          <label className="block max-w-xs">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.role}</span>
            <select
              value={form.values.role}
              onChange={(e) => form.setField("role", e.target.value)}
              disabled={readOnly}
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)] disabled:opacity-50"
            >
              <option value="USER">{m.roleUser}</option>
              <option value="ADMIN">{m.roleAdmin}</option>
            </select>
          </label>

          {isSelf && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
              {m.cannotEditSelf}
            </p>
          )}

          {!isSelf && (
            <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{m.resetLinkTitle}</h2>
                  <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{m.resetLinkHint}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={generateResetLink} disabled={resetting}>
                  {resetting ? m.resetLinkGenerating : m.resetLink}
                </Button>
              </div>
              {resetLink && (
                <div className="space-y-2">
                  <div className="break-all rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)]">
                    {resetLink.url}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                      {m.resetLinkExpires}: <DateDisplay date={resetLink.expiresAt} format="compact" />
                    </span>
                    <Button size="sm" onClick={copyResetLink}>{m.resetLinkCopy}</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <Badge variant={user.role === "ADMIN" ? "accent" : "default"}>
              {user.role === "ADMIN" ? m.roleAdmin : m.roleUser}
            </Badge>
          </div>
        </div>
      ) : null}
    </AdminDetailShell>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
      <p className="text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
