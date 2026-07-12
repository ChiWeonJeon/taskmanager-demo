"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/shared/locale-provider";

interface Member {
  id: string;
  userId: string;
  roleId: string;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string };
  isOwner: boolean;
}

export default function GroupMembersListPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = use(params);
  const { messages } = useI18n();
  const m = messages.groupMembersPage;

  const { data: members = [], isLoading, isError } = useQuery<Member[]>({
    queryKey: ["project-group", groupSlug, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/project-groups/${groupSlug}/members`);
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-w-0 w-full space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-w-0 w-full py-12 text-center text-sm text-[var(--color-danger)]">
        {m.loadFailed}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="min-w-0 w-full py-12 text-center text-sm text-[var(--color-text-tertiary)]">
        {m.empty}
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-3">
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {m.clickHint}
      </p>
      <ul className="space-y-1">
        {members.map((member) => (
          <li key={member.id}>
            <Link
              href={`/groups/${groupSlug}/tasks?assignee=${encodeURIComponent(member.userId)}`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{member.user.name}</span>
                <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">{member.user.email}</span>
              </div>
              {member.isOwner ? (
                <Badge variant="accent">{m.ownerBadge}</Badge>
              ) : (
                <Badge>{member.role.name}</Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
