"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import {
  AdminTabIcon,
  CalendarTabIcon,
  ProjectTabIcon,
  TodayIcon,
} from "@/components/task/task-icons";
import { cn } from "@/lib/utils";

type Section = "home" | "globe";

interface TabItem {
  href: string;
  label: string;
  active: boolean;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface Props {
  section: Section;
}

export function HomeGlobeTabs({ section }: Props) {
  const pathname = usePathname();
  const { messages } = useI18n();
  const sectionTitle = section === "home" ? messages.homeTabs.title : messages.globeTabs.title;
  const sectionDescription =
    section === "home" ? messages.homeTabs.description : messages.globeTabs.description;
  const sectionBadge = section === "home" ? messages.homeTabs.badge : messages.globeTabs.badge;
  const sectionLabel = section === "home" ? messages.nav.home : messages.nav.globe;
  const tabs: TabItem[] =
    section === "home"
      ? [
          {
            href: "/today",
            label: messages.homeTabs.today,
            active: pathname === "/today" || pathname.startsWith("/today/"),
            Icon: TodayIcon,
          },
          {
            href: "/tasks",
            label: messages.homeTabs.tasks,
            active: pathname === "/tasks" || pathname.startsWith("/tasks/"),
            Icon: ProjectTabIcon,
          },
          {
            href: "/my-activity",
            label: messages.homeTabs.activity,
            active: pathname === "/my-activity" || pathname.startsWith("/my-activity/"),
            Icon: AdminTabIcon,
          },
        ]
      : [
          {
            href: "/all-today",
            label: messages.globeTabs.today,
            active: pathname === "/all-today" || pathname.startsWith("/all-today/"),
            Icon: TodayIcon,
          },
          {
            href: "/all-tasks",
            label: messages.globeTabs.tasks,
            active: pathname === "/all-tasks" || pathname.startsWith("/all-tasks/"),
            Icon: ProjectTabIcon,
          },
          {
            href: "/all-cycles",
            label: messages.globeTabs.cycles,
            active: pathname === "/all-cycles" || pathname.startsWith("/all-cycles/"),
            Icon: CalendarTabIcon,
          },
          {
            href: "/all-activity",
            label: messages.globeTabs.activity,
            active: pathname === "/all-activity" || pathname.startsWith("/all-activity/"),
            Icon: AdminTabIcon,
          },
        ];

  return (
    <div className="mb-2 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-sm)]">
      <div className="flex min-w-0 flex-col gap-2 px-3 py-2.5 md:flex-row md:items-center md:gap-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
            {sectionBadge}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[length:var(--text-lg)] font-semibold leading-5 text-[var(--color-text-primary)]">
              {sectionTitle}
            </h1>
            <p className="hidden truncate text-[length:var(--text-2xs)] leading-4 text-[var(--color-text-tertiary)] md:block">
              {sectionDescription}
            </p>
          </div>
        </div>

        <nav
          className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 md:ml-auto md:shrink-0 md:pb-0"
          aria-label={sectionLabel}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[length:var(--text-xs)] font-medium whitespace-nowrap transition-colors",
                tab.active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
              )}
              title={tab.label}
              aria-label={tab.label}
            >
              <tab.Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
