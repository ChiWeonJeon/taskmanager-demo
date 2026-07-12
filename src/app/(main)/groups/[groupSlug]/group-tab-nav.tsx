"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/shared/locale-provider";
import {
  AdminTabIcon,
  CalendarTabIcon,
  FieldsIcon,
  HierarchyIcon,
  MembersTabIcon,
  ProjectTabIcon,
  TodayIcon,
} from "@/components/task/task-icons";

interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface Props {
  group: Group;
  canManage: boolean;
  canAccessCycle: boolean;
}

interface NavTab {
  key: string;
  href: string;
  label: string;
  active: boolean;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export function GroupTabNav({ group, canManage, canAccessCycle }: Props) {
  const pathname = usePathname();
  const basePath = `/groups/${group.slug}`;
  const { messages } = useI18n();
  const labels = messages.groupTabs;

  const tabs = useMemo<NavTab[]>(() => {
    const next: NavTab[] = [
      {
        key: "today",
        href: `${basePath}/today`,
        label: labels.today,
        active: pathname === `${basePath}/today` || pathname.startsWith(`${basePath}/today/`),
        Icon: TodayIcon,
      },
      {
        key: "dashboard",
        href: `${basePath}/dashboard`,
        label: labels.dashboard,
        active: pathname === `${basePath}/dashboard` || pathname.startsWith(`${basePath}/dashboard/`),
        Icon: HierarchyIcon,
      },
      {
        key: "tasks",
        href: `${basePath}/tasks`,
        label: labels.tasks,
        active: pathname === `${basePath}/tasks` || pathname.startsWith(`${basePath}/tasks/`),
        Icon: ProjectTabIcon,
      },
      {
        key: "checklists",
        href: `${basePath}/checklists`,
        label: labels.checklists,
        active:
          pathname === `${basePath}/checklists` ||
          pathname.startsWith(`${basePath}/checklists/`),
        Icon: FieldsIcon,
      },
      ...(canAccessCycle
        ? [{
            key: "cycles",
            href: `${basePath}/cycles`,
            label: labels.cycles,
            active: pathname === `${basePath}/cycles` || pathname.startsWith(`${basePath}/cycles/`),
            Icon: CalendarTabIcon,
          }]
        : []),
      {
        key: "members",
        href: `${basePath}/members`,
        label: labels.members,
        active: pathname === `${basePath}/members` || pathname.startsWith(`${basePath}/members/`),
        Icon: MembersTabIcon,
      },
      {
        key: "activity",
        href: `${basePath}/activity`,
        label: labels.activity,
        active: pathname === `${basePath}/activity` || pathname.startsWith(`${basePath}/activity/`),
        Icon: AdminTabIcon,
      },
    ];
    if (canManage) {
      next.push({
        key: "admin",
        href: `${basePath}/admin`,
        label: labels.admin,
        active: pathname.startsWith(`${basePath}/admin`),
        Icon: AdminTabIcon,
      });
    }
    return next;
  }, [basePath, canAccessCycle, canManage, pathname, labels]);

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[length:var(--text-xs)] font-medium whitespace-nowrap transition-colors",
      active
        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
        : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
    );

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-sm)]">
      <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex flex-1 items-center gap-2.5">
          <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
            {group.slug}
          </span>
          <h1
            title={group.description ? `${group.name} - ${group.description}` : group.name}
            className="max-w-[min(42ch,40vw)] truncate text-[length:var(--text-lg)] font-semibold leading-5 text-[var(--color-text-primary)]"
          >
            {group.name}
          </h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={tabClass(tab.active)}
              title={tab.label}
              aria-label={tab.label}
            >
              <tab.Icon className="h-3.5 w-3.5" />
              <span className={cn(tab.active ? "inline" : "hidden lg:inline")}>{tab.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
