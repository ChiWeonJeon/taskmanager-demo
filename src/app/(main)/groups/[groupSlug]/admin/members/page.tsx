"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/locale-provider";

interface Member {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
  isOwner: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function GroupMembersPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = use(params);
  const queryClient = useQueryClient();
  const { messages } = useI18n();
  const m = messages.groupAdminPage.members;

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["project-group", groupSlug, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/project-groups/${groupSlug}/members`);
      if (!res.ok) throw new Error();
      return res.json();
    },
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      return res.ok ? res.json() : [];
    },
  });

  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const memberUserIds = new Set(members.map((mem) => mem.userId));
  const addable = users.filter((u) => !memberUserIds.has(u.id));

  async function addMember() {
    if (!userId) return;
    setSaving(true);
    try {
      // 그룹 멤버십은 role-less. 역할은 프로젝트별로 부여되며 자동 상속 멤버는 기본 역할을 받는다.
      const res = await fetch(`/api/project-groups/${groupSlug}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["project-group", groupSlug, "members"] });
        setUserId("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm(m.removeConfirm)) return;
    await fetch(`/api/project-groups/${groupSlug}/members/${memberId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["project-group", groupSlug, "members"] });
  }

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">{m.addHeading}</h2>
        <p className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{m.roleManagedPerProject}</p>
        <div className="flex gap-2">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1 text-sm"
          >
            <option value="">{m.userPlaceholder}</option>
            {addable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addMember} disabled={!userId || saving}>
            {m.addSubmit}
          </Button>
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)] text-left text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
            <tr>
              <th className="px-3 py-2 font-medium">{m.colName}</th>
              <th className="px-3 py-2 font-medium">{m.colEmail}</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {members.map((mem) => (
              <tr key={mem.id}>
                <td className="px-3 py-2">
                  {mem.user.name} {mem.isOwner && <span className="text-[length:var(--text-3xs)] text-[var(--color-accent)]">Owner</span>}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">{mem.user.email}</td>
                <td className="px-3 py-2 text-right">
                  {!mem.isOwner && (
                    <Button variant="ghost" size="sm" onClick={() => removeMember(mem.id)}>
                      {m.removeButton}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
