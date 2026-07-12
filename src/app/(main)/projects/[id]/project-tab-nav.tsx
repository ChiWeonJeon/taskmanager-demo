"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { cn } from "@/lib/utils";
import {
  AdminTabIcon,
  CalendarTabIcon,
  FieldsIcon,
  MembersTabIcon,
  ProjectTabIcon,
  TodayIcon,
  TrashTabIcon,
} from "@/components/task/task-icons";

interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
}

interface Props {
  project: Project;
  canAccessAdmin: boolean;
  canAccessChecklist?: boolean;
  canAccessCycle?: boolean;
}

interface ProjectNavTab {
  key: string;
  href: string;
  label: string;
  active: boolean;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const INLINE_TAB_GAP = 6;
const HEADER_RESERVED_GAP = 20;
const MAX_INLINE_TABS = 4;

export function ProjectTabNav({
  project,
  canAccessAdmin,
  canAccessChecklist = false,
  canAccessCycle = false,
}: Props) {
  const pathname = usePathname();
  const { messages } = useI18n();
  const basePath = `/projects/${project.key}`;
  const [menuOpen, setMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const titleContentRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const morePanelRef = useRef<HTMLDivElement | null>(null);
  const measureRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const moreMeasureRef = useRef<HTMLSpanElement | null>(null);
  const projectTabsLabel = messages.projectTabs.tasks;
  const todayLabel = messages.projectTabs.today;
  const trashLabel = messages.projectTabs.trash;
  const adminLabel = messages.projectTabs.admin;
  const membersLabel = messages.projectTabs.members;
  const checklistLabel = messages.projectTabs.checklist;
  const activityLabel = messages.projectTabs.activity;
  const cyclesLabel = messages.projectTabs.cycles;

  const tabs = useMemo<ProjectNavTab[]>(() => {
    const next: ProjectNavTab[] = [
      {
        key: "today",
        href: `${basePath}/today`,
        label: todayLabel,
        active: pathname === `${basePath}/today` || pathname.startsWith(`${basePath}/today/`),
        Icon: TodayIcon,
      },
      {
        key: "tasks",
        href: `${basePath}/tasks`,
        label: projectTabsLabel,
        active: pathname === `${basePath}/tasks` || pathname.startsWith(`${basePath}/tasks/`),
        Icon: ProjectTabIcon,
      },
    ];

    if (canAccessChecklist) {
      next.push({
        key: "checklist",
        href: `${basePath}/checklists`,
        label: checklistLabel,
        active:
          pathname === `${basePath}/checklists` ||
          pathname.startsWith(`${basePath}/checklists/`),
        Icon: FieldsIcon,
      });
    }

    if (canAccessCycle) {
      next.push({
        key: "cycles",
        href: `${basePath}/cycles`,
        label: cyclesLabel,
        active: pathname === `${basePath}/cycles` || pathname.startsWith(`${basePath}/cycles/`),
        Icon: CalendarTabIcon,
      });
    }

    next.push({
      key: "members",
      href: `${basePath}/members`,
      label: membersLabel,
      active: pathname === `${basePath}/members` || pathname.startsWith(`${basePath}/members/`),
      Icon: MembersTabIcon,
    });

    next.push({
      key: "activity",
      href: `${basePath}/activity`,
      label: activityLabel,
      active: pathname === `${basePath}/activity` || pathname.startsWith(`${basePath}/activity/`),
      Icon: AdminTabIcon,
    });

    next.push({
      key: "trash",
      href: `${basePath}/trash`,
      label: trashLabel,
      active: pathname === `${basePath}/trash`,
      Icon: TrashTabIcon,
    });

    if (canAccessAdmin) {
      next.push({
        key: "admin",
        href: `${basePath}/admin`,
        label: adminLabel,
        active: pathname.startsWith(`${basePath}/admin`),
        Icon: AdminTabIcon,
      });
    }

    return next;
  }, [
    activityLabel,
    adminLabel,
    basePath,
    canAccessAdmin,
    canAccessChecklist,
    canAccessCycle,
    checklistLabel,
    cyclesLabel,
    membersLabel,
    pathname,
    projectTabsLabel,
    trashLabel,
    todayLabel,
  ]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (moreMenuRef.current?.contains(target)) return;
      if (morePanelRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const computeVisibleTabs = () => {
      const headerWidth = headerRef.current?.clientWidth ?? 0;
      const titleWidth = titleContentRef.current
        ? Math.ceil(titleContentRef.current.getBoundingClientRect().width)
        : 0;
      const activeTab = tabs.find((tab) => tab.active);
      const moreWidth = Math.max(
        moreMeasureRef.current?.offsetWidth ?? 64,
        activeTab ? (measureRefs.current[activeTab.key]?.offsetWidth ?? 0) : 0
      );

      if (headerWidth === 0 || titleWidth === 0) {
        setVisibleCount(Math.min(tabs.length, MAX_INLINE_TABS));
        return;
      }

      const availableWidth = Math.max(headerWidth - titleWidth - HEADER_RESERVED_GAP, 0);
      const inlineLimit = Math.min(tabs.length, MAX_INLINE_TABS);
      let usedWidth = 0;
      let nextVisibleCount = 0;

      for (let index = 0; index < inlineLimit; index += 1) {
        const tab = tabs[index];
        const tabWidth = measureRefs.current[tab.key]?.offsetWidth ?? 0;
        const nextWidth = usedWidth + (nextVisibleCount > 0 ? INLINE_TAB_GAP : 0) + tabWidth;
        const hasOverflowAfterThis = index < tabs.length - 1;
        const reservedMoreWidth = hasOverflowAfterThis ? INLINE_TAB_GAP + moreWidth : 0;

        if (nextWidth + reservedMoreWidth > availableWidth) break;

        usedWidth = nextWidth;
        nextVisibleCount = index + 1;
      }

      setVisibleCount(nextVisibleCount);
    };

    computeVisibleTabs();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(computeVisibleTabs);
    if (headerRef.current) observer.observe(headerRef.current);
    if (titleContentRef.current) observer.observe(titleContentRef.current);

    return () => observer.disconnect();
  }, [tabs]);

  const inlineTabs = tabs.slice(0, visibleCount);
  const overflowTabs = tabs.slice(visibleCount);
  const activeOverflowTab = overflowTabs.find((tab) => tab.active);
  const moreButtonActive = Boolean(activeOverflowTab);
  const moreButtonLabel = activeOverflowTab?.label ?? messages.nav.more;
  const moreButtonAriaLabel = activeOverflowTab
    ? `${messages.nav.more}: ${activeOverflowTab.label}`
    : messages.nav.more;

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[length:var(--text-xs)] font-medium whitespace-nowrap transition-colors",
      active
        ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
        : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
    );

  const renderTabContent = (tab: ProjectNavTab): ReactNode => (
    <>
      <tab.Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{tab.label}</span>
    </>
  );

  return (
    <div className="sticky top-0 z-30 overflow-visible bg-[var(--color-bg-primary)]">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-sm)]">
        <div ref={headerRef} className="flex min-w-0 items-center gap-3 px-4 py-2.5">
          <div className="min-w-[6rem] flex flex-1 items-center gap-2.5">
            <div ref={titleContentRef} className="flex min-w-0 max-w-full items-center gap-2.5">
              <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                {project.key.toLowerCase()}
              </span>
              <h1
                title={project.description ? `${project.name} - ${project.description}` : project.name}
                className="min-w-0 max-w-[min(42ch,40vw)] truncate text-[length:var(--text-lg)] font-semibold leading-5 text-[var(--color-text-primary)]"
              >
                {project.name}
              </h1>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {inlineTabs.map((tab) => (
              <Link key={tab.key} href={tab.href} className={tabClass(tab.active)} title={tab.label} aria-label={tab.label}>
                {renderTabContent(tab)}
              </Link>
            ))}

            {overflowTabs.length > 0 && (
              <div ref={moreMenuRef} className="relative">
                <button
                  ref={moreButtonRef}
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className={tabClass(moreButtonActive || menuOpen)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={moreButtonAriaLabel}
                  title={moreButtonLabel}
                >
                  {activeOverflowTab ? renderTabContent(activeOverflowTab) : messages.nav.more}
                </button>

                <FloatingPortal
                  open={menuOpen}
                  anchorRef={moreButtonRef}
                  floatingRef={morePanelRef}
                  placement="bottom"
                  align="end"
                  offset={4}
                  preferredWidth={160}
                  maxHeight={360}
                  zIndex={130}
                  className="min-w-[10rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1 shadow-[var(--shadow-md)]"
                >
                    {overflowTabs.map((tab) => (
                      <Link
                        key={tab.key}
                        href={tab.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-[length:var(--text-xs)] transition-colors",
                          tab.active
                            ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                            : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                        )}
                      >
                        <tab.Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </Link>
                    ))}
                </FloatingPortal>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] top-0 -z-10 flex items-center gap-1.5 opacity-0"
      >
        {tabs.map((tab) => (
          <span
            key={tab.key}
            ref={(node) => {
              measureRefs.current[tab.key] = node;
            }}
            className={tabClass(tab.active)}
          >
            <tab.Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{tab.label}</span>
          </span>
        ))}
        <span ref={moreMeasureRef} className={tabClass(false)}>
          {messages.nav.more}
        </span>
      </div>
    </div>
  );
}
