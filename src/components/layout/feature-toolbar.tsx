import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const featureToolbarSurfaceClass =
  "rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-1 md:p-0";

export const featureToolbarRowClass =
  "flex min-w-0 flex-nowrap items-center gap-1.5 overflow-visible py-0.5 md:justify-end";

export const featureToolbarButtonClass =
  "inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 text-[length:var(--text-sm)] leading-none text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] md:h-8 md:min-w-8 md:px-2 md:text-[length:var(--text-xs)] 2xl:px-3";

export const featureToolbarButtonActiveClass =
  "bg-[var(--color-accent-light)] text-[var(--color-accent)]";

export const featureToolbarPrimaryButtonClass =
  "inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 text-[length:var(--text-sm)] leading-none text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:pointer-events-none disabled:opacity-50 md:h-8 md:min-w-8 md:px-2 md:text-[length:var(--text-xs)] 2xl:px-3";

export const featureToolbarIconButtonClass =
  "h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]";

export const featureToolbarBadgeClass =
  "rounded-full bg-[var(--color-accent-light)] px-1.5 text-[length:var(--text-3xs)] text-[var(--color-accent)]";

export const featureToolbarPanelClass =
  "rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-2";

export const featureToolbarLabelClass = "inline truncate";

export const featureToolbarResponsiveLabelClass =
  "hidden truncate @[52rem]/toolbar-controls:inline";

export const featureToolbarSegmentedClass =
  "inline-flex h-10 shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-secondary)] p-0.5 md:h-8";

export const featureToolbarSegmentButtonClass =
  "inline-flex min-w-9 items-center justify-center rounded-full px-3 text-[length:var(--text-sm)] leading-none transition-colors md:text-[length:var(--text-xs)]";

export const featureToolbarSelectClass =
  "h-8 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]";

interface FeatureToolbarProps {
  children: ReactNode;
  className?: string;
  rowClassName?: string;
}

export function FeatureToolbar({ children, className, rowClassName }: FeatureToolbarProps) {
  return (
    <div data-feature-toolbar="true" className={cn(featureToolbarSurfaceClass, className)}>
      <div data-feature-toolbar-row="true" className={cn(featureToolbarRowClass, rowClassName)}>
        {children}
      </div>
    </div>
  );
}
