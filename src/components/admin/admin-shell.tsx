import Link from "next/link";
import { ReactNode } from "react";

interface AdminBreadcrumb {
  label: string;
  href?: string;
}

interface AdminShellProps {
  title: string;
  description?: string;
  breadcrumbs: AdminBreadcrumb[];
  action?: ReactNode;
  children: ReactNode;
}

export function AdminShell({
  title,
  description,
  breadcrumbs,
  action,
  children,
}: AdminShellProps) {
  return (
    <div data-service-page="admin" className="min-w-0 w-full space-y-6">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-2">
              {breadcrumb.href ? (
                <Link href={breadcrumb.href} className="transition-colors hover:text-[var(--color-text-primary)]">
                  {breadcrumb.label}
                </Link>
              ) : (
                <span className="text-[var(--color-text-primary)]">{breadcrumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
            {description && <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>

      {children}
    </div>
  );
}
