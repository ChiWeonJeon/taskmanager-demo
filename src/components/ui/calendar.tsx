"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { cn } from "@/lib/utils";

export interface CalendarProps {
  /** Currently selected date (YYYY-MM-DD). */
  value?: string | null;
  /** Selected handler. Returns YYYY-MM-DD. */
  onSelect?: (date: string) => void;
  /** Set of YYYY-MM-DD strings to display a marker dot on. */
  markedDates?: ReadonlySet<string>;
  /** YYYY-MM month to display on first render. Defaults to current month or value's month. */
  initialMonth?: { year: number; month: number };
  /** Optional callback fired when the visible month changes. */
  onMonthChange?: (year: number, month: number) => void;
  /** Disable date selection beyond today. */
  disableFuture?: boolean;
  className?: string;
}

function formatYmd(year: number, monthIndex0: number, day: number): string {
  const m = String(monthIndex0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function todayYmd(): string {
  const t = new Date();
  return formatYmd(t.getFullYear(), t.getMonth(), t.getDate());
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

export function Calendar({
  value,
  onSelect,
  markedDates,
  initialMonth,
  onMonthChange,
  disableFuture = false,
  className,
}: CalendarProps) {
  const { messages } = useI18n();
  const t = messages.calendar;
  const monthLabels = t.months;
  const weekdayLabels = t.weekdays;

  const seedFromValue = value ? parseYmd(value) : null;
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    if (initialMonth) return initialMonth;
    if (seedFromValue) return { year: seedFromValue.year, month: seedFromValue.month };
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const today = todayYmd();

  const days = useMemo(() => {
    const firstDay = new Date(view.year, view.month, 1);
    const lastDay = new Date(view.year, view.month + 1, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: Array<{ ymd: string; day: number; isOther: boolean } | null> = [];
    for (let i = 0; i < startWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= totalDays; d += 1) {
      cells.push({ ymd: formatYmd(view.year, view.month, d), day: d, isOther: false });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const goMonth = (delta: number) => {
    let m = view.month + delta;
    let y = view.year;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    setView({ year: y, month: m });
    onMonthChange?.(y, m);
  };

  const goToday = () => {
    const t2 = new Date();
    setView({ year: t2.getFullYear(), month: t2.getMonth() });
    onMonthChange?.(t2.getFullYear(), t2.getMonth());
  };

  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          aria-label={t.previousMonth}
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
            {view.year} {monthLabels[view.month]}
          </span>
          <button
            type="button"
            onClick={goToday}
            className="rounded-[var(--radius-md)] border border-transparent px-2 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            {t.today}
          </button>
        </div>
        <button
          type="button"
          onClick={() => goMonth(1)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          aria-label={t.nextMonth}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[length:var(--text-3xs)] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {weekdayLabels.map((label, idx) => (
          <div key={idx} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, idx) => {
          if (!cell) return <div key={idx} className="aspect-square" />;
          const isSelected = value === cell.ymd;
          const isToday = today === cell.ymd;
          const isMarked = markedDates?.has(cell.ymd) ?? false;
          const isDisabled = disableFuture && cell.ymd > today;

          return (
            <button
              key={idx}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect?.(cell.ymd)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-[var(--radius-md)] text-[length:var(--text-xs)] transition-colors",
                isSelected
                  ? "bg-[var(--color-accent)] text-white"
                  : isToday
                    ? "border border-[var(--color-accent)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]",
                isDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
              )}
            >
              {cell.day}
              {isMarked && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1 inline-block h-1 w-1 rounded-full",
                    isSelected ? "bg-white" : "bg-[var(--color-accent)]"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Build a Set of marked YYYY-MM-DD strings from a list of ISO datetimes. */
export function buildMarkedSet(isoDates: ReadonlyArray<string>): Set<string> {
  const out = new Set<string>();
  for (const iso of isoDates) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    out.add(formatYmd(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return out;
}
