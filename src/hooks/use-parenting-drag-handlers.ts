import { useRef, useState } from "react";
import type { WorkItemUpdate, WorkItemWithRelations } from "@/components/task/types";
import { useDragSuppressClick } from "@/hooks/use-drag-suppress-click";

export interface ParentingDragRowProps {
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

export interface ParentingDragContainerProps {
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

export interface UseParentingDragHandlersReturn {
  draggingId: string | null;
  dropTargetId: string | null;
  showRootDropHint: boolean;
  rowProps: (taskId: string) => ParentingDragRowProps;
  containerProps: () => ParentingDragContainerProps;
  shouldSuppressClick: () => boolean;
  notifyDragEnded: () => void;
}

/**
 * 리스트/그리드/간트 좌측 공통 "부모 변경(parenting) DnD" 핸들러.
 * - 행에 drop → onUpdate(source, { parentId: targetId })
 * - 빈 컨테이너에 drop → 자식 태스크만 parentId=null (루트화)
 * - 순환 참조(descendant에게 부모 지정) 차단
 * - 드래그 종료 시 useDragSuppressClick.notifyDragEnded 자동 호출
 *
 * 칸반은 "status 변경 + parentId 변경"이 섞여 있어 이 훅 대신
 * useDragSuppressClick만 사용.
 */
export function useParentingDragHandlers(
  tasks: WorkItemWithRelations[],
  onUpdate?: (id: string, data: WorkItemUpdate) => void,
): UseParentingDragHandlersReturn {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const { notifyDragEnded, shouldSuppressClick } = useDragSuppressClick();

  const childMap = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentId) {
      const siblings = childMap.get(task.parentId) ?? [];
      siblings.push(task.id);
      childMap.set(task.parentId, siblings);
    }
  }

  const getDescendantIds = (taskId: string): Set<string> => {
    const result = new Set<string>();
    const queue = [taskId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const childId of childMap.get(id) ?? []) {
        result.add(childId);
        queue.push(childId);
      }
    }
    return result;
  };

  const reset = () => {
    draggedIdRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    notifyDragEnded();
  };

  const rowProps = (taskId: string): ParentingDragRowProps => ({
    onDragStart: (event) => {
      draggedIdRef.current = taskId;
      setDraggingId(taskId);
      event.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: () => reset(),
    onDragOver: (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = draggedIdRef.current;
      if (!sourceId || sourceId === taskId) return;
      if (getDescendantIds(sourceId).has(taskId)) {
        event.dataTransfer.dropEffect = "none";
        return;
      }
      const sourceTask = tasks.find((t) => t.id === sourceId);
      if (sourceTask?.parentId === taskId) {
        setDropTargetId(null);
        return;
      }
      event.dataTransfer.dropEffect = "move";
      setDropTargetId(taskId);
    },
    onDragLeave: (event) => {
      const currentTarget = event.currentTarget as Node;
      const related = event.relatedTarget as Node | null;
      if (related && currentTarget.contains(related)) return;
      if (dropTargetId === taskId) setDropTargetId(null);
    },
    onDrop: (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = draggedIdRef.current;
      if (!sourceId || sourceId === taskId) {
        reset();
        return;
      }
      if (getDescendantIds(sourceId).has(taskId)) {
        reset();
        return;
      }
      onUpdate?.(sourceId, { parentId: taskId });
      reset();
    },
  });

  const containerProps = (): ParentingDragContainerProps => ({
    onDragOver: (event) => {
      const sourceId = draggedIdRef.current;
      if (!sourceId) return;
      const sourceTask = tasks.find((t) => t.id === sourceId);
      if (sourceTask?.parentId) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }
    },
    onDrop: (event) => {
      event.preventDefault();
      const sourceId = draggedIdRef.current;
      if (!sourceId) {
        reset();
        return;
      }
      const sourceTask = tasks.find((t) => t.id === sourceId);
      if (sourceTask?.parentId && !dropTargetId) {
        onUpdate?.(sourceId, { parentId: null });
      }
      reset();
    },
  });

  const draggingTask = draggingId ? tasks.find((t) => t.id === draggingId) : null;
  const showRootDropHint = !!draggingTask?.parentId && dropTargetId === null;

  return {
    draggingId,
    dropTargetId,
    showRootDropHint,
    rowProps,
    containerProps,
    shouldSuppressClick,
    notifyDragEnded,
  };
}
