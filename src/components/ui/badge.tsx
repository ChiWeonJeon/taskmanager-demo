import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent";
type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  color?: string;
  size?: BadgeSize;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]",
  success:
    "bg-[var(--color-success-light)] text-[var(--color-success)]",
  warning:
    "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
  danger:
    "bg-[var(--color-danger-light)] text-[var(--color-danger)]",
  accent:
    "bg-[var(--color-accent-light)] text-[var(--color-accent)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[length:var(--text-3xs)]",
  md: "px-2 py-0.5 text-[length:var(--text-2xs)]",
};

export function Badge({
  className,
  variant = "default",
  color,
  size = "md",
  style,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-full)] font-medium",
        sizeStyles[size],
        !color && variantStyles[variant],
        className
      )}
      style={
        color
          ? { backgroundColor: `${color}20`, color, ...style }
          : style
      }
      {...props}
    />
  );
}
