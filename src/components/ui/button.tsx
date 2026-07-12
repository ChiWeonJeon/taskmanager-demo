import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]",
  secondary:
    "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]",
  ghost:
    "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:opacity-90",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[length:var(--text-xs)]",
  md: "h-9 px-3 text-[length:var(--text-sm)]",
  lg: "h-10 px-4 text-[length:var(--text-base)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
