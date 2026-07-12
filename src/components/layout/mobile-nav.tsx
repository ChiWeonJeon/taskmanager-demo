"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-access";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { useI18n } from "@/components/shared/locale-provider";
import { NotificationList } from "@/components/notifications/notification-list";
import { UserAvatar } from "@/components/ui/avatar";
import { BellIcon, FolderIcon, GlobeIcon, HomeIcon, MenuIcon, PencilIcon } from "@/components/task/task-icons";
import { getDisplayName, type DisplayUser } from "@/lib/user/display";

const isReadOnlyDemo = process.env.NEXT_PUBLIC_DEMO_READ_ONLY === "true";

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { messages } = useI18n();
  const queryClient = useQueryClient();
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const navigation = [
    { name: messages.nav.home, href: "/today", Icon: HomeIcon },
    { name: messages.nav.globe, href: "/all-today", Icon: GlobeIcon },
    { name: messages.nav.projects, href: "/projects", Icon: FolderIcon },
  ];
  const isPathActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isNavActive = (href: string) => {
    if (href === "/today") {
      return pathname === "/home" || isPathActive("/tasks") || isPathActive("/today") || isPathActive("/my-activity");
    }
    if (href === "/all-today") {
      return pathname === "/globe" || isPathActive("/all-tasks") || isPathActive("/all-today") || isPathActive("/all-cycles") || isPathActive("/all-activity");
    }
    return isPathActive(href);
  };
  const isDarkMode = themeMounted && resolvedTheme === "dark";

  useEffect(() => {
    const timer = window.setTimeout(() => setThemeMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

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

  const unreadQuery = useQuery<{ count: number }>({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!session?.user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const unreadCount = unreadQuery.data?.count ?? 0;

  const handleLogout = () => {
    setAccountOpen(false);
    signOut({ redirect: false }).then(async () => {
      await queryClient.clear();
      window.location.href = "/login";
    });
  };

  return (
    <>
      <nav className="mobile-nav-root fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        {navigation.map((item) => {
          const isActive = isNavActive(item.href);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 transition-colors",
                isActive
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)]"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[length:var(--text-2xs)] font-medium leading-none whitespace-nowrap">{item.name}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setNotificationsOpen(true)}
          aria-label={messages.nav.notifications}
          className={cn(
            "relative flex flex-1 flex-col items-center gap-1 py-2 transition-colors",
            notificationsOpen ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"
          )}
        >
          <span className="relative">
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -right-1 -top-0.5 inline-block h-2 w-2 rounded-full bg-[var(--color-danger)]"
              />
            )}
          </span>
          <span className="text-[length:var(--text-2xs)] font-medium leading-none whitespace-nowrap">{messages.nav.notifications}</span>
        </button>
        {!isReadOnlyDemo && <button
          type="button"
          onClick={() => setCreateTaskOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[var(--color-text-secondary)] transition-colors"
        >
          <PencilIcon className="h-5 w-5" />
          <span className="text-[length:var(--text-2xs)] font-medium leading-none whitespace-nowrap">{messages.nav.createTask}</span>
        </button>}
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2 transition-colors",
            accountOpen ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"
          )}
        >
          <MenuIcon className="h-5 w-5" />
          <span className="text-[length:var(--text-2xs)] font-medium leading-none whitespace-nowrap">{messages.nav.more}</span>
        </button>
      </nav>

      {!isReadOnlyDemo && createTaskOpen && (
        <CreateTaskModal onClose={() => setCreateTaskOpen(false)} />
      )}

      {notificationsOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 md:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setNotificationsOpen(false);
          }}
        >
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {messages.nav.notifications}
              </span>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              >
                {messages.common.close}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NotificationList
                variant="dropdown"
                pageSize={20}
                onItemClick={() => setNotificationsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {accountOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 md:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAccountOpen(false);
          }}
        >
          <div className="absolute inset-x-0 bottom-0 rounded-t-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-[var(--shadow-lg)]">
            {session?.user && (
              <div className="mb-4 flex items-center gap-3">
                {me && <UserAvatar user={me} size="lg" />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {(me ? getDisplayName(me) : session.user.name) ?? messages.nav.user}
                  </div>
                  {session.user.email && (
                    <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {session.user.email}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-center text-sm font-semibold text-[var(--color-text-primary)]">
                {messages.app.name}
              </div>
              <Link
                href="/profile"
                onClick={() => setAccountOpen(false)}
                className="flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              >
                {messages.nav.myProfile}
              </Link>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
                <LocaleSwitcher />
              </div>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setAccountOpen(false)}
                  className="flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
                >
                  {messages.nav.admin}
                </Link>
              )}
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-center"
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              >
                {isDarkMode ? messages.nav.switchToLightMode : messages.nav.switchToDarkMode}
              </Button>
              {session?.user && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-center"
                  onClick={handleLogout}
                >
                  {messages.nav.logout}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-center"
                onClick={() => setAccountOpen(false)}
              >
                {messages.common.close}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
