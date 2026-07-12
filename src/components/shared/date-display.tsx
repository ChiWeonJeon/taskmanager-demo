"use client";

import { formatDate, parseDateOnly } from "@/lib/date";

interface DateDisplayProps {
  date: Date | string;
  format?: "full" | "short" | "date" | "compact";
  className?: string;
  dateOnly?: boolean;
}

export function DateDisplay({
  date,
  format = "full",
  className,
  dateOnly,
}: DateDisplayProps) {
  const shouldParseDateOnly = dateOnly ?? format === "date";
  const d = shouldParseDateOnly ? parseDateOnly(date) : (typeof date === "string" ? new Date(date) : date);
  const isValid = !Number.isNaN(d.getTime());
  const tooltip = isValid ? formatDate(d, "tooltip") : undefined;

  return (
    <time dateTime={isValid ? d.toISOString() : undefined} className={className} title={tooltip}>
      {formatDate(d, format)}
    </time>
  );
}
