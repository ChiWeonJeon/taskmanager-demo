"use client";

import { useEffect, useId, useRef } from "react";

export interface DismissableLayerEntry {
  id: string;
  closeOnEscape: boolean;
}

export class DismissableLayerStack {
  private entries: DismissableLayerEntry[] = [];

  add(entry: DismissableLayerEntry) {
    this.remove(entry.id);
    this.entries.push(entry);
  }

  remove(id: string) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
  }

  top() {
    return this.entries.at(-1) ?? null;
  }

  isTop(id: string) {
    return this.top()?.id === id;
  }

  clear() {
    this.entries = [];
  }
}

export const dismissableLayerStack = new DismissableLayerStack();

interface UseDismissableLayerOptions {
  open: boolean;
  onDismiss: () => void;
  closeOnEscape?: boolean;
}

export function useDismissableLayer({
  open,
  onDismiss,
  closeOnEscape = true,
}: UseDismissableLayerOptions) {
  const generatedId = useId();
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;
    dismissableLayerStack.add({ id: generatedId, closeOnEscape });
    return () => dismissableLayerStack.remove(generatedId);
  }, [closeOnEscape, generatedId, open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const top = dismissableLayerStack.top();
      if (!top || top.id !== generatedId || !top.closeOnEscape) return;
      event.preventDefault();
      onDismissRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, generatedId, open]);

  return {
    layerId: generatedId,
    isTopLayer: () => dismissableLayerStack.isTop(generatedId),
  };
}
