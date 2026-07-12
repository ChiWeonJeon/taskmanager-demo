"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/components/shared/locale-provider";

// Shared chrome for every admin detail / create route.
//
// It enforces the staged-edit contract that all admin pages must follow:
//   - a sticky action bar with Save / Discard that is gated on dirty + valid,
//   - Cmd/Ctrl+S to save, an Esc-free explicit flow,
//   - an unsaved-changes guard (beforeunload + guarded breadcrumb navigation),
//   - an optional danger zone for destructive actions (delete),
//   - a readOnly mode for resources that are not editable (e.g. logs).
//
// Visible labels come from `messages.adminCommon` so the shell stays i18n-driven.
// NOTE(ai-followup): [배경] Next.js App Router has no stable client-navigation
// interception API. [작업] This shell only guards explicit exit points it owns
// (breadcrumb links) + beforeunload. A global in-app navigation guard (e.g.
// patching <Link>) is deferred. [테스트] Verify dirty + breadcrumb click shows
// the leave dialog, and dirty + browser refresh shows the native prompt.

interface AdminBreadcrumb {
  label: string;
  href?: string;
}

interface AdminDetailShellProps {
  title: string;
  breadcrumbs: AdminBreadcrumb[];
  /** Staged form is different from the server baseline. */
  isDirty: boolean;
  /** Staged form passes validation (Save stays disabled until true). */
  isValid: boolean;
  /** A save mutation is in flight. */
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** When provided (and not readOnly), renders a danger zone with a delete action. */
  onDelete?: () => void;
  deleting?: boolean;
  /** Override the danger-zone delete confirmation copy (defaults to adminCommon). */
  deleteConfirmTitle?: string;
  deleteConfirmDescription?: string;
  dangerZoneDescription?: string;
  /** Hides the save bar and danger zone (view-only resources). */
  readOnly?: boolean;
  children: ReactNode;
}

export function AdminDetailShell({
  title,
  breadcrumbs,
  isDirty,
  isValid,
  isSaving,
  onSave,
  onDiscard,
  onDelete,
  deleting = false,
  deleteConfirmTitle,
  deleteConfirmDescription,
  dangerZoneDescription,
  readOnly = false,
  children,
}: AdminDetailShellProps) {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.adminCommon;

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canSave = isDirty && isValid && !isSaving;

  // Browser-level guard (refresh / close / external navigation).
  useEffect(() => {
    if (!isDirty || readOnly) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, readOnly]);

  // Cmd/Ctrl+S saves when the form is dirty + valid.
  useEffect(() => {
    if (readOnly) return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isDirty && isValid && !isSaving) onSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly, isDirty, isValid, isSaving, onSave]);

  const guardedNavigate = useCallback(
    (href: string) => {
      if (isDirty && !readOnly) {
        setPendingHref(href);
      } else {
        router.push(href);
      }
    },
    [isDirty, readOnly, router],
  );

  return (
    <div data-service-page="admin-detail" className="min-w-0 w-full pb-36 md:pb-24">
      <div className="space-y-3">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]"
        >
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-2">
              {breadcrumb.href ? (
                <a
                  href={breadcrumb.href}
                  onClick={(event) => {
                    event.preventDefault();
                    guardedNavigate(breadcrumb.href!);
                  }}
                  className="cursor-pointer transition-colors hover:text-[var(--color-text-primary)]"
                >
                  {breadcrumb.label}
                </a>
              ) : (
                <span className="text-[var(--color-text-primary)]">{breadcrumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
            </div>
          ))}
        </nav>

        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
      </div>

      <div className="mt-6 space-y-6">{children}</div>

      {!readOnly && onDelete && (
        <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-danger)]/40 bg-[var(--color-bg-primary)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-danger)]">
                {m.dangerZone}
              </h2>
              {dangerZoneDescription && (
                <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                  {dangerZoneDescription}
                </p>
              )}
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
            >
              {deleting ? m.deleting : m.delete}
            </Button>
          </div>
        </section>
      )}

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur transition-[left] duration-200 supports-[backdrop-filter]:bg-[var(--color-bg-primary)]/80 md:bottom-0 md:left-[var(--sidebar-current-width)]">
          <div data-service-sticky-content="true" className="flex min-w-0 w-full items-center justify-between gap-3 px-2 py-3 md:px-3">
            <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
              {isDirty ? m.unsavedChanges : m.noChanges}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onDiscard}
                disabled={!isDirty || isSaving}
              >
                {m.discard}
              </Button>
              <Button size="sm" onClick={onSave} disabled={!canSave}>
                {isSaving ? m.saving : m.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingHref !== null}
        title={m.leaveTitle}
        description={m.leaveConfirm}
        confirmLabel={m.leaveConfirmAction}
        cancelLabel={m.cancel}
        onConfirm={() => {
          const href = pendingHref;
          setPendingHref(null);
          if (href) router.push(href);
        }}
        onCancel={() => setPendingHref(null)}
      />

      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          title={deleteConfirmTitle ?? m.confirmDelete}
          description={deleteConfirmDescription}
          confirmLabel={m.delete}
          cancelLabel={m.cancel}
          variant="danger"
          busy={deleting}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
