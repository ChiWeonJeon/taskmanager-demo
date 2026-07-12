"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/shared/locale-provider";

// Toolbar above admin list tables: a search box on the left and a primary
// action slot (typically the "Create" CTA) on the right. Pairs with
// useTableControls + <DataTable> to give every admin list the same
// search/sort/create affordances.

interface AdminListToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Right-aligned action(s), e.g. a Create button. */
  action?: ReactNode;
}

export function AdminListToolbar({
  query,
  onQueryChange,
  searchPlaceholder,
  action,
}: AdminListToolbarProps) {
  const { messages } = useI18n();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Input
        inputSize="sm"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={searchPlaceholder ?? messages.adminCommon.search}
        className="sm:max-w-xs"
        aria-label={searchPlaceholder ?? messages.adminCommon.search}
      />
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
