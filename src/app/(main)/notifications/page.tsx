"use client";

import { useI18n } from "@/components/shared/locale-provider";
import { NotificationList } from "@/components/notifications/notification-list";

export default function NotificationsPage() {
  const { messages } = useI18n();
  const t = messages.notifications.page;

  return (
    <div data-service-page="notifications" className="flex min-w-0 w-full flex-col gap-3 py-1 md:py-2">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text-primary)]">{t.title}</h1>
        <p className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{t.description}</p>
      </header>
      <div className="overflow-hidden rounded-md bg-[var(--color-bg-primary)]">
        <NotificationList variant="page" pageSize={30} />
      </div>
    </div>
  );
}
