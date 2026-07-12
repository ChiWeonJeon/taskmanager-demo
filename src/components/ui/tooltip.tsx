"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
  side?: "top" | "bottom";
  className?: string;
}

export function Tooltip({ content, children, delay = 350, side = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      setOpen(true);
    }, delay);
  }, [clearShowTimer, delay]);

  const handleLeave = useCallback(() => {
    clearShowTimer();
    setOpen(false);
  }, [clearShowTimer]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => clearShowTimer(), [clearShowTimer]);

  const bubble = (
    <FloatingPortal
      open={open}
      anchorRef={wrapperRef}
      floatingRef={tooltipRef}
      placement={side}
      align="center"
      offset={8}
      zIndex={150}
      id={tooltipId}
      role="tooltip"
      style={{ pointerEvents: "none" }}
      className={cn(
        "rounded-[var(--radius-sm)] bg-[var(--color-text-primary)] px-2 py-1 text-[length:var(--text-2xs)] font-medium text-[var(--color-bg-primary)] shadow-[var(--shadow-md)]",
        "max-w-[280px] whitespace-pre-wrap break-words",
        className,
      )}
    >
      {content}
    </FloatingPortal>
  );

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      aria-describedby={open ? tooltipId : undefined}
      className="contents"
    >
      {children}
      {bubble}
    </span>
  );
}
