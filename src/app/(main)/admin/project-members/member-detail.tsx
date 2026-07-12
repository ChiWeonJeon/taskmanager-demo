"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleId: string;
  source?: string;
  groupName?: string | null;
  createdAt: string;
  isOwner?: boolean;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string };
  project: { id: string; name: string; key: string; ownerId?: string | null; isPersonal?: boolean };
}
interface UserOption { id: string; name: string; email: string }
interface RoleOption { id: string; name: string }
interface ProjectOption { id: string; name: string; key: string }

interface FormState {
  projectId: string;
  userId: string;
  roleId: string;
}

const EMPTY: FormState = { projectId: "", userId: "", roleId: "" };

interface MemberDetailProps {
  mode: "new" | "edit";
  memberId?: string;
}

export function MemberDetail({ mode, memberId }: MemberDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.admin.projectMembers;

  const { data: members = [], isLoading } = useQuery<ProjectMember[]>({
    queryKey: ["admin-project-members"],
    queryFn: async () => {
      const r = await fetch("/api/admin/project-members");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
    enabled: mode === "edit",
  });
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
    enabled: mode === "new",
  });
  const { data: roles = [] } = useQuery<RoleOption[]>({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const r = await fetch("/api/admin/roles");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
  });
  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const r = await fetch("/api/admin/projects");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
    enabled: mode === "new",
  });

  const member = mode === "edit" ? members.find((x) => x.id === memberId) : undefined;
  const form = useStagedForm<FormState>(EMPTY);

  const syncedRef = useRef("");
  useEffect(() => {
    if (mode !== "edit") return;
    if (!member) return;
    if (syncedRef.current === member.id) return;
    syncedRef.current = member.id;
    form.reset({ projectId: member.projectId, userId: member.userId, roleId: member.roleId });
  }, [mode, member, form]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-project-members"] });

  const createMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const r = await fetch("/api/admin/project-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || messages.errors.failedToCreate);
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.created, { type: "success" });
      router.push("/admin/project-members");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const updateMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const r = await fetch(`/api/admin/project-members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || messages.adminUsersPage.roleChangeFailed);
      }
    },
    onSuccess: async (_d, roleId) => {
      await invalidate();
      form.reset({ ...form.values, roleId });
      toast(m.updated, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/project-members/${memberId}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || messages.errors.failedToDelete);
      }
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.removed, { type: "success" });
      router.push("/admin/project-members");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const v = form.values;
  const isOwner = Boolean(member?.isOwner);
  const isPersonal = Boolean(member?.project.isPersonal);
  const isInherited = member?.source === "group";
  const notFound = mode === "edit" && !isLoading && !member;
  const locked = isOwner || isPersonal;
  // 상속 멤버는 역할 변경은 가능(readOnly 아님)하되 직접 삭제는 불가.
  const readOnly = mode === "edit" && (locked || notFound);

  const isValid = mode === "new" ? Boolean(v.projectId && v.userId && v.roleId) : Boolean(v.roleId);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminDetailShell
      title={mode === "new" ? m.createTitle : member ? member.user.name : m.editTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title, href: "/admin/project-members" },
        { label: mode === "new" ? m.createTitle : member?.user.name ?? m.editTitle },
      ]}
      isDirty={form.isDirty}
      isValid={isValid}
      isSaving={isSaving}
      onSave={() => (mode === "new" ? createMutation.mutate(v) : updateMutation.mutate(v.roleId))}
      onDiscard={() => form.reset()}
      onDelete={mode === "edit" && member && !locked && !isInherited ? () => removeMutation.mutate() : undefined}
      deleting={removeMutation.isPending}
      deleteConfirmTitle={m.confirmRemove}
      deleteConfirmDescription={m.dangerZoneDescription}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={readOnly}
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : mode === "new" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label={m.project}>
            <Select value={v.projectId} onChange={(val) => form.setField("projectId", val)} placeholder={m.selectProject}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.key}] {p.name}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label={m.user}>
            <Select value={v.userId} onChange={(val) => form.setField("userId", val)} placeholder={m.selectUser}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label={m.role}>
            <Select value={v.roleId} onChange={(val) => form.setField("roleId", val)} placeholder={m.selectRole}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Labeled>
        </div>
      ) : member ? (
        <div className="space-y-5">
          {locked && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{m.ownerLockHint}</p>
          )}
          {isInherited && !locked && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
              {messages.projectMembersPage.inheritedHint.replace("{group}", member.groupName ?? "")}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadField label={m.project} value={`[${member.project.key}] ${member.project.name}`} />
            <ReadField label={m.user} value={`${member.user.name} (${member.user.email})`} />
          </div>
          <label className="block max-w-xs">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.role}</span>
            {isOwner ? (
              <div><Badge variant="accent">{m.owner}</Badge></div>
            ) : (
              <Select value={v.roleId} onChange={(val) => form.setField("roleId", val)} disabled={readOnly}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </label>
        </div>
      ) : null}
    </AdminDetailShell>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)] disabled:opacity-50"
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children}
    </select>
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
