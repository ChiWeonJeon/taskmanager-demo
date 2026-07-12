"use client";

import type { AppLocale } from "@/lib/i18n/config";
import { useI18n } from "@/components/shared/locale-provider";

export function LocaleSwitcher({
  className = "",
}: {
  className?: string;
}) {
  const { locale, setLocale, supportedLocales, messages } = useI18n();

  return (
    <label className={`flex items-center gap-2 text-xs text-[var(--color-text-secondary)] ${className}`.trim()}>
      <span>{messages.locale.label}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as AppLocale)}
        className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-xs text-[var(--color-text-primary)]"
      >
        {supportedLocales.map((option) => (
          <option key={option} value={option}>
            {messages.locale.options[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
