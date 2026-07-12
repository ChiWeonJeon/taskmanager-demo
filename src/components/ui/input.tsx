import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: InputSize;
}

const INPUT_SIZE_CLASS: Record<InputSize, string> = {
  sm: "h-8 text-[length:var(--text-xs)] px-2",
  md: "h-9 text-[length:var(--text-sm)] px-2.5 py-1.5",
  lg: "h-10 text-[length:var(--text-base)] px-3",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputSize = "md", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          INPUT_SIZE_CLASS[inputSize],
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
