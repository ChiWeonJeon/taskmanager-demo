"use client";

import { useQuery } from "@tanstack/react-query";
import { UserAvatar } from "@/components/ui/avatar";
import { useI18n } from "@/components/shared/locale-provider";
import { DateDisplay } from "@/components/shared/date-display";
import type { DisplayUser } from "@/lib/user/display";

interface MeProfile extends DisplayUser {
  email: string;
  role: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { messages } = useI18n();
  const { data: me } = useQuery<MeProfile>({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await fetch("/api/me");
      if (!response.ok) throw new Error("failed");
      return response.json();
    },
  });

  return (
    <div data-service-page="profile" className="min-w-0 w-full py-4 md:py-6">
      <header className="mb-6">
        <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text-primary)]">{messages.profile.title}</h1>
        <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{messages.demo.readOnlyNotice}</p>
      </header>
      <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5">
        <div className="flex items-center gap-4">
          {me ? <UserAvatar user={me} size="lg" /> : <div className="h-10 w-10 rounded-full bg-[var(--color-bg-secondary)]" />}
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{me?.name ?? messages.nav.user}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{me?.email}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-[var(--color-text-tertiary)]">{messages.profile.accountRole}</dt><dd className="mt-1 text-[var(--color-text-primary)]">Viewer</dd></div>
          <div><dt className="text-[var(--color-text-tertiary)]">{messages.profile.accountCreated}</dt><dd className="mt-1 text-[var(--color-text-primary)]">{me?.createdAt ? <DateDisplay date={me.createdAt} /> : "—"}</dd></div>
        </dl>
      </section>
    </div>
  );
}
