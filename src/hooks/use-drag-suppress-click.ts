import { useRef } from "react";

export interface UseDragSuppressClickOptions {
  windowMs?: number;
}

export interface DragSuppressClickApi {
  notifyDragEnded: () => void;
  shouldSuppressClick: () => boolean;
}

export function useDragSuppressClick(
  opts?: UseDragSuppressClickOptions,
): DragSuppressClickApi {
  const endedAtRef = useRef<number | null>(null);
  const windowMs = opts?.windowMs ?? 150;

  return {
    notifyDragEnded: () => {
      endedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    },
    shouldSuppressClick: () => {
      const t = endedAtRef.current;
      if (t == null) return false;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const recent = now - t < windowMs;
      if (recent) {
        endedAtRef.current = null;
      }
      return recent;
    },
  };
}
