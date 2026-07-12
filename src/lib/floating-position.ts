export type FloatingPlacement = "top" | "bottom" | "left" | "right";
export type FloatingAlign = "start" | "center" | "end";

export interface FloatingRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface FloatingSize {
  width: number;
  height: number;
}

export interface FloatingViewport {
  width: number;
  height: number;
}

export interface FloatingPositionOptions {
  placement?: FloatingPlacement;
  align?: FloatingAlign;
  offset?: number;
  viewportMargin?: number;
  preferredWidth?: number;
  maxHeight?: number;
  viewport?: FloatingViewport;
}

export interface FloatingPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: FloatingPlacement;
}

const DEFAULT_MARGIN = 8;
const DEFAULT_OFFSET = 4;

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function resolveWidth(size: FloatingSize, viewport: FloatingViewport, margin: number, preferredWidth?: number) {
  const maxWidth = Math.max(0, viewport.width - margin * 2);
  const requestedWidth = preferredWidth ?? size.width;
  return clamp(requestedWidth > 0 ? requestedWidth : maxWidth, 0, maxWidth);
}

function resolveVerticalPlacement(
  placement: FloatingPlacement,
  anchor: FloatingRect,
  height: number,
  viewport: FloatingViewport,
  margin: number,
  offset: number,
) {
  if (placement !== "top" && placement !== "bottom") return placement;

  const spaceBelow = viewport.height - anchor.bottom - offset - margin;
  const spaceAbove = anchor.top - offset - margin;

  if (placement === "bottom" && height > spaceBelow && spaceAbove > spaceBelow) return "top";
  if (placement === "top" && height > spaceAbove && spaceBelow > spaceAbove) return "bottom";
  return placement;
}

function resolveHorizontalPlacement(
  placement: FloatingPlacement,
  anchor: FloatingRect,
  width: number,
  viewport: FloatingViewport,
  margin: number,
  offset: number,
) {
  if (placement !== "left" && placement !== "right") return placement;

  const spaceRight = viewport.width - anchor.right - offset - margin;
  const spaceLeft = anchor.left - offset - margin;

  if (placement === "right" && width > spaceRight && spaceLeft > spaceRight) return "left";
  if (placement === "left" && width > spaceLeft && spaceRight > spaceLeft) return "right";
  return placement;
}

function resolveMainAxisTop(
  placement: FloatingPlacement,
  anchor: FloatingRect,
  contentHeight: number,
  viewport: FloatingViewport,
  margin: number,
  offset: number,
) {
  if (placement === "top") return anchor.top - offset - contentHeight;
  if (placement === "bottom") return anchor.bottom + offset;
  return anchor.top + anchor.height / 2 - contentHeight / 2;
}

function resolveMainAxisLeft(
  placement: FloatingPlacement,
  anchor: FloatingRect,
  width: number,
  viewport: FloatingViewport,
  margin: number,
  offset: number,
) {
  if (placement === "left") return anchor.left - offset - width;
  if (placement === "right") return anchor.right + offset;
  return anchor.left;
}

function resolveCrossAxisLeft(align: FloatingAlign, anchor: FloatingRect, width: number) {
  if (align === "center") return anchor.left + anchor.width / 2 - width / 2;
  if (align === "end") return anchor.right - width;
  return anchor.left;
}

function resolveCrossAxisTop(align: FloatingAlign, anchor: FloatingRect, contentHeight: number) {
  if (align === "center") return anchor.top + anchor.height / 2 - contentHeight / 2;
  if (align === "end") return anchor.bottom - contentHeight;
  return anchor.top;
}

export function pointToFloatingRect(point: { x: number; y: number }): FloatingRect {
  return {
    top: point.y,
    left: point.x,
    right: point.x,
    bottom: point.y,
    width: 0,
    height: 0,
  };
}

export function resolveFloatingPosition(
  anchor: FloatingRect,
  size: FloatingSize,
  options: FloatingPositionOptions = {},
): FloatingPosition {
  const viewport = options.viewport ?? {
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  };
  const margin = options.viewportMargin ?? DEFAULT_MARGIN;
  const offset = options.offset ?? DEFAULT_OFFSET;
  const width = resolveWidth(size, viewport, margin, options.preferredWidth);
  const viewportMaxHeight = Math.max(0, viewport.height - margin * 2);
  const requestedMaxHeight = options.maxHeight ?? viewportMaxHeight;
  const unclampedHeight = size.height > 0 ? size.height : requestedMaxHeight;
  const measuredHeight = clamp(unclampedHeight, 0, viewportMaxHeight);
  const preferredPlacement = options.placement ?? "bottom";
  const verticalPlacement = resolveVerticalPlacement(preferredPlacement, anchor, measuredHeight, viewport, margin, offset);
  const placement = resolveHorizontalPlacement(verticalPlacement, anchor, width, viewport, margin, offset);

  let left =
    placement === "top" || placement === "bottom"
      ? resolveCrossAxisLeft(options.align ?? "start", anchor, width)
      : resolveMainAxisLeft(placement, anchor, width, viewport, margin, offset);
  let top =
    placement === "left" || placement === "right"
      ? resolveCrossAxisTop(options.align ?? "start", anchor, measuredHeight)
      : resolveMainAxisTop(placement, anchor, measuredHeight, viewport, margin, offset);

  left = clamp(left, margin, viewport.width - width - margin);
  top = clamp(top, margin, viewport.height - measuredHeight - margin);

  const availableHeight =
    placement === "bottom"
      ? viewport.height - top - margin
      : placement === "top"
        ? anchor.top - offset - margin
        : viewport.height - margin * 2;
  const maxHeight = clamp(Math.min(requestedMaxHeight, availableHeight), 0, viewportMaxHeight);

  return {
    top,
    left,
    width,
    maxHeight,
    placement,
  };
}
