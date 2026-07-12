"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { isAdminUser } from "@/lib/admin-access";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { useI18n } from "@/components/shared/locale-provider";
import { SidebarProjectList } from "@/components/layout/sidebar-project-list";
import { UserAvatar } from "@/components/ui/avatar";
import { FloatingPortal } from "@/components/ui/floating-portal";
import {
  AdminTabIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  GlobeIcon,
  GroupIcon,
  HomeIcon,
  LogoutIcon,
  MoonIcon,
  PencilIcon,
  SunIcon,
  UserIcon,
} from "@/components/task/task-icons";
import { getDisplayName, type DisplayUser } from "@/lib/user/display";

// NotificationBell uses document.body + getBoundingClientRect via createPortal,
// so it must render on the client only.
const NotificationBell = dynamic(
  () => import("@/components/notifications/notification-bell").then((m) => m.NotificationBell),
  { ssr: false }
);

const isReadOnlyDemo = process.env.NEXT_PUBLIC_DEMO_READ_ONLY === "true";

interface Project {
  id: string;
  name: string;
  key: string;
  groupId?: string | null;
  sortOrderInGroup?: number;
  createdAt?: string;
}

interface ProjectGroup {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { messages } = useI18n();
  const queryClient = useQueryClient();
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountPanelRef = useRef<HTMLDivElement | null>(null);
  const skipInitialCollapsedSaveRef = useRef(true);
  const isDarkMode = themeMounted && resolvedTheme === "dark";

  useEffect(() => {
    const timer = window.setTimeout(() => setThemeMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem("sidebar-collapsed") !== "true") return;
    // Apply browser-only sidebar chrome after hydration so SSR markup remains stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(true);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-current-width",
      collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)"
    );
    if (skipInitialCollapsedSaveRef.current) {
      skipInitialCollapsedSaveRef.current = false;
      return;
    }
    window.localStorage.setItem("sidebar-collapsed", collapsed ? "true" : "false");
  }, [collapsed]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (accountMenuRef.current?.contains(target)) return;
      if (accountPanelRef.current?.contains(target)) return;
      setAccountMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const { data: myProjects = [] } = useQuery<Project[]>({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects?memberId=me");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const { data: me } = useQuery<DisplayUser & { email: string; role: string }>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error("Failed to fetch me");
      return res.json();
    },
    enabled: !!session?.user,
  });
  const isAdmin = isAdminUser(me ?? session?.user);

  const { data: myGroups = [] } = useQuery<ProjectGroup[]>({
    queryKey: ["my-project-groups"],
    queryFn: async () => {
      const res = await fetch("/api/project-groups?memberId=me");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const navItemClass = (active: boolean) =>
    cn(
      "flex w-full items-center rounded-[var(--radius-md)] font-medium transition-colors text-left",
      collapsed
        ? "min-h-12 flex-col justify-center gap-0.5 px-0.5 py-1 text-center text-[length:var(--text-3xs)] leading-3"
        : "gap-2.5 px-3 py-1.5 text-[length:var(--text-sm)]",
      active
        ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
    );

  const isPathActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isHomeActive = pathname === "/home" || isPathActive("/tasks") || isPathActive("/today") || isPathActive("/my-activity");
  const isGlobeActive = pathname === "/globe" || isPathActive("/all-tasks") || isPathActive("/all-today") || isPathActive("/all-cycles") || isPathActive("/all-activity");
  const isProjectsOverviewActive = pathname === "/projects" || pathname === "/projects/";

  const handleLogout = () => {
    setAccountMenuOpen(false);
    signOut({ redirect: false }).then(async () => {
      await queryClient.clear();
      window.location.href = "/login";
    });
  };

  return (
    <aside
      className="hidden md:flex md:flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] h-dvh fixed left-0 top-0 transition-all duration-200"
      style={{ width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
    >
      <div className={cn("flex h-[var(--topbar-height)] items-center border-b border-[var(--color-border)]", collapsed ? "justify-center gap-1 px-0" : "justify-between gap-2 px-3")}>
        <div className={cn("min-w-0 font-semibold text-[var(--color-text-primary)]", collapsed ? "shrink-0" : "flex-1")}>
          {collapsed ? "TM" : messages.app.name}
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              "flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
              collapsed ? "h-8 w-7" : "h-7 w-7",
            )}
            aria-label={collapsed ? messages.nav.expandSidebar : messages.nav.collapseSidebar}
            title={collapsed ? messages.nav.expandSidebar : messages.nav.collapseSidebar}
          >
            {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <Link
          href="/today"
          className={navItemClass(isHomeActive)}
          title={messages.nav.home}
        >
          <HomeIcon className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "w-full truncate px-0.5")}>{messages.nav.home}</span>
        </Link>

        <Link
          href="/all-today"
          className={navItemClass(isGlobeActive)}
          title={messages.nav.globe}
        >
          <GlobeIcon className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "w-full truncate px-0.5")}>{messages.nav.globe}</span>
        </Link>

        <div>
          <Link
            href="/projects"
            className={navItemClass(isProjectsOverviewActive)}
            title={messages.nav.projects}
          >
            <FolderIcon className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "w-full truncate px-0.5")}>{messages.nav.projects}</span>
          </Link>
          {!collapsed && (myProjects.length > 0 || myGroups.length > 0) && (
            <SidebarProjectList projects={myProjects} groups={myGroups} />
          )}
        </div>

        <Link
          href="/groups"
          className={navItemClass(pathname === "/groups" || pathname === "/groups/")}
          title={messages.nav.groups}
        >
          <GroupIcon className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "w-full truncate px-0.5")}>{messages.nav.groups}</span>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className={navItemClass(pathname.startsWith("/admin"))}
            title={messages.nav.admin}
          >
            <AdminTabIcon className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "w-full truncate px-0.5")}>{messages.nav.admin}</span>
          </Link>
        )}

        {!isReadOnlyDemo && <button
          type="button"
          onClick={() => setCreateTaskOpen(true)}
          className={navItemClass(false)}
          title={messages.nav.createTask}
        >
          <PencilIcon className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "w-full truncate px-0.5")}>{messages.nav.createTask}</span>
        </button>}

      </nav>

      <div className="border-t border-[var(--color-border)] p-2">
        <div ref={accountMenuRef} className="relative">
          {!collapsed ? (
            <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-1 py-1">
              <button
                ref={accountButtonRef}
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-left text-[length:var(--text-xs)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
                title={(me ? getDisplayName(me) : session?.user?.name) ?? messages.nav.userMenu}
              >
                {me && <UserAvatar user={me} size="sm" />}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {(me ? getDisplayName(me) : session?.user?.name) ?? messages.nav.user}
                </span>
                <ChevronDownIcon className={cn("h-3 w-3 text-[var(--color-text-tertiary)] transition-transform", accountMenuOpen && "rotate-180")} />
              </button>

              <span className="shrink-0 px-1 text-[length:var(--text-3xs)] font-mono text-[var(--color-text-tertiary)]">
                {`v${process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"}`}
              </span>

              <NotificationBell compact />

              <button
                type="button"
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                title={isDarkMode ? messages.nav.switchToLightMode : messages.nav.switchToDarkMode}
              >
                {isDarkMode ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>

              {isAdmin && (
                <Link
                  href="/admin"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
                    pathname.startsWith("/admin") && "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  )}
                  title={messages.nav.admin}
                >
                  <AdminTabIcon className="h-4 w-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                ref={accountButtonRef}
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="flex h-8 w-full items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                title={(me ? getDisplayName(me) : session?.user?.name) ?? messages.nav.userMenu}
              >
                {me ? <UserAvatar user={me} size="md" /> : <UserIcon className="h-4 w-4" />}
              </button>
              <div className="flex justify-center">
                <NotificationBell />
              </div>
              <button
                type="button"
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                className="flex h-8 w-full items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                title={isDarkMode ? messages.nav.switchToLightMode : messages.nav.switchToDarkMode}
              >
                {isDarkMode ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={cn(
                    "flex h-8 w-full items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
                    pathname.startsWith("/admin") && "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  )}
                  title={messages.nav.admin}
                >
                  <AdminTabIcon className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}

          <FloatingPortal
            open={accountMenuOpen}
            anchorRef={accountButtonRef}
            floatingRef={accountPanelRef}
            placement="top"
            align="start"
            offset={8}
            preferredWidth={collapsed ? 176 : 260}
            maxHeight={420}
            zIndex={130}
            className={cn(
              "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-md)]",
              collapsed ? "w-44" : "w-[260px]",
            )}
          >
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
                {me && <UserAvatar user={me} size="md" />}
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                    {(me ? getDisplayName(me) : session?.user?.name) ?? messages.nav.user}
                  </div>
                  {session?.user?.email && (
                    <div className="mt-0.5 truncate text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                      {session.user.email}
                    </div>
                  )}
                </div>
              </div>
              <Link
                href="/profile"
                onClick={() => setAccountMenuOpen(false)}
                className="flex w-full items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              >
                <UserIcon className="h-4 w-4" />
                <span>{messages.nav.myProfile}</span>
              </Link>
              <div className="border-b border-[var(--color-border)] px-3 py-2">
                <LocaleSwitcher />
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              >
                <LogoutIcon className="h-4 w-4" />
                <span>{messages.nav.logout}</span>
              </button>
          </FloatingPortal>
        </div>
      </div>

      {!isReadOnlyDemo && createTaskOpen && (
        <CreateTaskModal onClose={() => setCreateTaskOpen(false)} />
      )}
    </aside>
  );
}
