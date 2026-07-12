"use client";

import Link from "next/link";
import { use } from "react";
import { useI18n } from "@/components/shared/locale-provider";

export default function GroupAdminPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = use(params);
  const { messages } = useI18n();
  const m = messages.groupAdminPage;
  const base = `/groups/${groupSlug}/admin`;
  const cards = [
    { href: `${base}/settings`, title: m.settingsTitle, desc: m.settingsDesc },
    { href: `${base}/members`, title: m.membersTitle, desc: m.membersDesc },
    { href: `${base}/projects`, title: m.projectsTitle, desc: m.projectsDesc },
  ];
  return (
    <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 hover:bg-[var(--color-bg-hover)]"
        >
          <h3 className="text-sm font-semibold">{card.title}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{card.desc}</p>
        </Link>
      ))}
    </div>
  );
}
