"use client";

import { useI18n } from "@/components/shared/locale-provider";

export function DemoReadOnlyBanner() {
  const { messages } = useI18n();
  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-accent-light)] px-3 py-1.5 text-center text-[length:var(--text-xs)] font-semibold text-[var(--color-accent)]">
      {messages.demo.badge}
    </div>
  );
}
