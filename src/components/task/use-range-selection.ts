"use client";

import { useCallback, useMemo, useRef } from "react";

interface UseRangeSelectionParams {
  orderedIds: string[];
  onToggleMany: (ids: string[], selected: boolean) => void;
  getAnchorId?: () => string | null;
  setAnchorId?: (id: string | null) => void;
}

export function useRangeSelection({
  orderedIds,
  onToggleMany,
  getAnchorId,
  setAnchorId,
}: UseRangeSelectionParams) {
  const localAnchorIdRef = useRef<string | null>(null);
  const indexById = useMemo(() => new Map(orderedIds.map((id, index) => [id, index])), [orderedIds]);
  const readAnchorId = useCallback(() => getAnchorId?.() ?? localAnchorIdRef.current, [getAnchorId]);
  const writeAnchorId = useCallback((id: string | null) => {
    if (setAnchorId) {
      setAnchorId(id);
      return;
    }
    localAnchorIdRef.current = id;
  }, [setAnchorId]);

  return useCallback((id: string, selected: boolean, shiftKey: boolean) => {
    const anchorId = readAnchorId();
    const anchorIndex = anchorId ? indexById.get(anchorId) : undefined;
    const targetIndex = indexById.get(id);

    if (shiftKey && anchorIndex !== undefined && targetIndex !== undefined) {
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      onToggleMany(orderedIds.slice(start, end + 1), selected);
    } else {
      onToggleMany([id], selected);
    }

    writeAnchorId(id);
  }, [indexById, onToggleMany, orderedIds, readAnchorId, writeAnchorId]);
}
