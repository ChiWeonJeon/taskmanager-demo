import Link from "next/link";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  ariaLabel?: string;
}

export function Breadcrumbs({ items, className, ariaLabel = "Breadcrumbs" }: BreadcrumbsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-tertiary)]", className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-[var(--color-accent)]">
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && "font-medium text-[var(--color-text-primary)]")}>
                {item.label}
              </span>
            )}
            {!isLast && <span aria-hidden="true">/</span>}
          </div>
        );
      })}
    </nav>
  );
}
