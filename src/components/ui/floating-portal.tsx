"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  pointToFloatingRect,
  resolveFloatingPosition,
  type FloatingAlign,
  type FloatingPlacement,
  type FloatingPosition,
  type FloatingRect,
} from "@/lib/floating-position";
import { cn } from "@/lib/utils";

interface FloatingPortalProps {
  open: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
  anchorPoint?: { x: number; y: number } | null;
  floatingRef?: RefObject<HTMLDivElement | null>;
  placement?: FloatingPlacement;
  align?: FloatingAlign;
  offset?: number;
  viewportMargin?: number;
  preferredWidth?: number;
  maxHeight?: number;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
  role?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onRequestClose?: () => void;
}

function rectFromElement(element: HTMLElement): FloatingRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function positionsEqual(left: FloatingPosition | null, right: FloatingPosition | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.top === right.top &&
    left.left === right.left &&
    left.width === right.width &&
    left.maxHeight === right.maxHeight &&
    left.placement === right.placement
  );
}

export function FloatingPortal({
  open,
  anchorRef,
  anchorPoint,
  floatingRef,
  placement = "bottom",
  align = "start",
  offset = 4,
  viewportMargin = 8,
  preferredWidth,
  maxHeight,
  zIndex = 120,
  className,
  style,
  children,
  id,
  role,
  onClick,
  onRequestClose,
}: FloatingPortalProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const setFloatingNode = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (floatingRef) {
        floatingRef.current = node;
      }
    },
    [floatingRef],
  );

  const updatePosition = useCallback(() => {
    const anchor = anchorPoint ? pointToFloatingRect(anchorPoint) : anchorRef?.current ? rectFromElement(anchorRef.current) : null;
    if (!anchor) {
      onRequestClose?.();
      return;
    }

    const floatingRect = internalRef.current?.getBoundingClientRect();
    const next = resolveFloatingPosition(
      anchor,
      {
        width: floatingRect?.width ?? preferredWidth ?? 0,
        height: floatingRect?.height ?? maxHeight ?? 0,
      },
      {
        placement,
        align,
        offset,
        viewportMargin,
        preferredWidth,
        maxHeight,
      },
    );
    setPosition((current) => (positionsEqual(current, next) ? current : next));
  }, [align, anchorPoint, anchorRef, maxHeight, offset, onRequestClose, placement, preferredWidth, viewportMargin]);

  useLayoutEffect(() => {
    if (!open) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open || !internalRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(internalRef.current);
    return () => observer.disconnect();
  }, [open, updatePosition]);

  if (!open || typeof document === "undefined") return null;

  const floatingStyle: CSSProperties = {
    position: "fixed",
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    width: position?.width ?? preferredWidth,
    maxHeight: position?.maxHeight ?? maxHeight,
    zIndex,
    visibility: position ? undefined : "hidden",
    ...style,
  };

  return createPortal(
    <div
      ref={setFloatingNode}
      id={id}
      role={role}
      onClick={onClick}
      data-floating-placement={position?.placement}
      style={floatingStyle}
      className={cn("overflow-y-auto", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
