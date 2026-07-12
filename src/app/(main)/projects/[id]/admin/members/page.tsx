"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { useI18n } from "@/components/shared/locale-provider";

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
  project: { id: string; name: string; key: string };
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string;
  isSystem: boolean;
}

export default function ProjectMembersAdminPage() {
  const params = useParams<{ id: string }>();
  const projectIdOrKey = params.id;
  const queryClient = useQueryClient();
  const { messages } = useI18n();
  const m = messages.projectMembersPage;
  const adminCrumb = messages.projectAdminPage;

  const { data: members = [], isLoading } = useQuery<ProjectMember[]>({
    queryKey: ["project-members", projectIdOrKey],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectIdOrKey}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const { data: project } = useQuery({
    queryKey: ["project", projectIdOrKey],
    queryFn: async () => {
      const res = await fetch("/api/projects?memberId=me");
      if (!res.ok) return null;
      const all = await res.json();
      return all.find((p: { id: string; key: string }) => p.id === projectIdOrKey || p.key === projectIdOrKey) ?? null;
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ userId: "", roleId: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoleId, setEditRoleId] = useState("");

  const ownerMember = members.find((member) => member.isOwner);
  const addableUsers = users.filter((user) => !members.some((member) => member.userId === user.id));
  const canTransferOwnership = members.length > 1;

  const invalidateProjectQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["project-members", projectIdOrKey] });
    queryClient.invalidateQueries({ queryKey: ["my-projects"] });
    queryClient.invalidateQueries({ queryKey: ["project", projectIdOrKey] });
  };

  const addMember = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`/api/projects/${projectIdOrKey}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || m.addFailed);
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProjectQueries();
      setShowForm(false);
      setFormData({ userId: "", roleId: "" });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ id, roleId }: { id: string; roleId: string }) => {
      const res = await fetch(`/api/projects/${projectIdOrKey}/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || m.updateFailed);
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProjectQueries();
      setEditingId(null);
      setEditRoleId("");
    },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${projectIdOrKey}/members/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || m.deleteFailed);
      }
    },
    onSuccess: () => invalidateProjectQueries(),
  });

  const transferOwnership = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/projects/${projectIdOrKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: userId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || m.transferFailed);
      }
      return res.json();
    },
    onSuccess: () => invalidateProjectQueries(),
  });

  return (
    <div className="min-w-0 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            ariaLabel={messages.commonUi.breadcrumbsLabel}
            items={[
              { label: adminCrumb.projectsCrumb, href: "/projects" },
              project
                ? { label: project.name, href: `/projects/${project.key}` }
                : { label: adminCrumb.projectsCrumb, href: `/projects/${projectIdOrKey}` },
              { label: adminCrumb.adminCrumb, href: `/projects/${project?.key ?? projectIdOrKey}/admin` },
              { label: m.title },
            ]}
            className="mb-2"
          />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{m.title}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {m.description}
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>{m.addMember}</Button>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        <span className="font-medium text-[var(--color-text-primary)]">{m.currentOwner}</span>
        <span className="ml-2">{ownerMember ? `${ownerMember.user.name} (${ownerMember.user.email})` : m.unassignedOwner}</span>
        <span className="ml-3 text-xs text-[var(--color-text-tertiary)]">{m.ownerHint}</span>
      </div>

      {showForm && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{m.newMemberHeading}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={formData.userId}
              onChange={(e) => setFormData((prev) => ({ ...prev, userId: e.target.value }))}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">{m.userPlaceholder}</option>
              {addableUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
              ))}
            </select>
            <select
              value={formData.roleId}
              onChange={(e) => setFormData((prev) => ({ ...prev, roleId: e.target.value }))}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">{m.rolePlaceholder}</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => addMember.mutate(formData)}
              disabled={!formData.userId || !formData.roleId || addMember.isPending}
            >
              {m.addSubmit}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setFormData({ userId: "", roleId: "" }); }}
            >
              {m.cancel}
            </Button>
            {addMember.error && (
              <span className="text-xs text-[var(--color-danger)]">{(addMember.error as Error).message}</span>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)] animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
          {m.noMembersHint}
        </div>
      ) : (
        <div className="space-y-1">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{member.user.name}</span>
                <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">{member.user.email}</span>
              </div>
              {editingId === member.id ? (
                <div className="flex items-center gap-2">
                  <select
                    value={editRoleId}
                    onChange={(e) => setEditRoleId(e.target.value)}
                    className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)]"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <Button variant="primary" size="sm" onClick={() => updateMemberRole.mutate({ id: member.id, roleId: editRoleId })} disabled={updateMemberRole.isPending}>{m.save}</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditRoleId(""); }}>{m.cancel}</Button>
                </div>
              ) : (
                <>
                  {member.isOwner && <Badge variant="accent">{m.ownerBadge}</Badge>}
                  {!member.isOwner && member.source === "group" && (
                    <Badge
                      variant="default"
                      title={m.inheritedHint.replace("{group}", member.groupName ?? "")}
                    >
                      {m.inheritedBadge}
                    </Badge>
                  )}
                  {member.isOwner ? (
                    <span className="text-xs text-[var(--color-text-tertiary)]">{m.roleNone}</span>
                  ) : (
                    <Badge>{member.role.name}</Badge>
                  )}
                  <div className="flex items-center gap-1">
                    {!member.isOwner && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(member.id); setEditRoleId(member.roleId); }}>{m.changeRole}</Button>
                    )}
                    {!member.isOwner && member.source !== "group" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(m.transferConfirm.replace("{name}", member.user.name))) {
                            transferOwnership.mutate(member.userId);
                          }
                        }}
                        disabled={!canTransferOwnership || transferOwnership.isPending}
                      >
                        {m.transferOwnership}
                      </Button>
                    )}
                    {!member.isOwner && member.source !== "group" && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => { if (confirm(m.removeConfirm.replace("{name}", member.user.name))) removeMember.mutate(member.id); }}
                        disabled={removeMember.isPending}
                      >
                        {m.remove}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {(updateMemberRole.error || removeMember.error || transferOwnership.error) && (
            <div className="pt-2 text-xs text-[var(--color-danger)]">
              {((updateMemberRole.error || removeMember.error || transferOwnership.error) as Error).message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
