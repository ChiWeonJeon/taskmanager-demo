"use client";

import { useCallback, useState } from "react";
import {
  EMPTY_TASK_COLUMN_STATE,
  type TaskColumnState,
} from "@/lib/task-column-model";

export function useTaskColumnState() {
  const [state, setState] = useState<TaskColumnState>(EMPTY_TASK_COLUMN_STATE);

  const updateState = useCallback((updater: (current: TaskColumnState) => TaskColumnState) => {
    setState((current) => updater(current));
  }, []);

  return {
    columnState: state,
    setColumnState: setState,
    updateColumnState: updateState,
  };
}
