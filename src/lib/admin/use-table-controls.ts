"use client";

import { useMemo, useState } from "react";
import type { DataTableSort, SortDirection } from "@/components/data-table/data-table";

// Client-side search + sort for admin list tables. Admin datasets are small
// (roles, statuses, fields, …) so filtering/sorting in the browser keeps the
// list pages simple and avoids new API params. Pages wire the returned `sort`
// and `toggleSort` straight into <DataTable>.

interface TableControlsOptions<T> {
  /** Free-text search target for each row (matched case-insensitively). */
  searchAccessor: (row: T) => string;
  /** Sort key per sortable column id. */
  sortAccessors?: Record<string, (row: T) => string | number>;
  initialSort?: DataTableSort | null;
}

interface TableControls<T> {
  query: string;
  setQuery: (value: string) => void;
  sort: DataTableSort | null;
  toggleSort: (columnId: string) => void;
  rows: T[];
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function useTableControls<T>(
  source: T[],
  { searchAccessor, sortAccessors, initialSort = null }: TableControlsOptions<T>,
): TableControls<T> {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DataTableSort | null>(initialSort);

  function toggleSort(columnId: string) {
    setSort((current) => {
      if (current?.columnId !== columnId) {
        return { columnId, direction: "asc" satisfies SortDirection };
      }
      // asc → desc → off
      if (current.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
  }

  const rows = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    let result = source;

    if (trimmed) {
      result = result.filter((row) =>
        searchAccessor(row).toLowerCase().includes(trimmed),
      );
    }

    if (sort && sortAccessors?.[sort.columnId]) {
      const accessor = sortAccessors[sort.columnId];
      const factor = sort.direction === "asc" ? 1 : -1;
      result = [...result].sort(
        (a, b) => compare(accessor(a), accessor(b)) * factor,
      );
    }

    return result;
  }, [source, query, sort, searchAccessor, sortAccessors]);

  return { query, setQuery, sort, toggleSort, rows };
}
