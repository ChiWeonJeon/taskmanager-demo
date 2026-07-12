"use client";

import { useCallback, useState } from "react";

// Shared staged-edit form state for admin detail pages.
//
// All admin detail/edit screens follow the same contract: load a server record
// into a local "staged" copy, let the user edit freely, and only enable Save
// once the staged copy actually differs from the server baseline (dirty). On a
// successful save the baseline is re-synced so the form returns to a clean
// state. This hook centralises that logic so every admin page computes
// `isDirty` the same way instead of hand-rolling per-field disabled conditions.

/**
 * Stable structural equality used for dirty tracking. Admin form values are
 * plain JSON-serialisable objects (strings, numbers, booleans, arrays of those),
 * so a normalised JSON comparison is sufficient and avoids an extra dependency.
 *
 * Object keys are sorted so that key ordering never produces a false-positive
 * dirty state.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (val as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return val;
  });
}

export function stagedValuesEqual<T>(a: T, b: T): boolean {
  return stableStringify(a) === stableStringify(b);
}

export interface StagedForm<T> {
  /** Current staged (in-progress) values. */
  values: T;
  /** Replace the whole staged value (supports updater fn like setState). */
  setValues: (next: T | ((current: T) => T)) => void;
  /** Update a single staged field. */
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  /** True when staged values differ from the server baseline. */
  isDirty: boolean;
  /**
   * Reset the staged values back to a clean state. Pass a new baseline (e.g. the
   * server record returned after a successful save) to re-sync; omit to discard
   * edits back to the current baseline.
   */
  reset: (next?: T) => void;
}

export function useStagedForm<T>(initialBaseline: T): StagedForm<T> {
  // Baseline lives in state (not a ref) so `isDirty` can be derived during
  // render without violating the react-hooks/refs rule. Consumers re-sync the
  // baseline via reset(next) once a server record loads or a save succeeds.
  const [baseline, setBaseline] = useState<T>(initialBaseline);
  const [values, setValuesState] = useState<T>(initialBaseline);

  const setValues = useCallback((next: T | ((current: T) => T)) => {
    setValuesState((current) =>
      typeof next === "function" ? (next as (c: T) => T)(current) : next,
    );
  }, []);

  const setField = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValuesState((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const reset = useCallback(
    (next?: T) => {
      if (next !== undefined) {
        setBaseline(next);
        setValuesState(next);
      } else {
        setValuesState(baseline);
      }
    },
    [baseline],
  );

  const isDirty = !stagedValuesEqual(values, baseline);

  return { values, setValues, setField, isDirty, reset };
}
