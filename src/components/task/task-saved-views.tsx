"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { featureToolbarBadgeClass, featureToolbarButtonActiveClass, featureToolbarButtonClass, featureToolbarLabelClass } from "@/components/layout/feature-toolbar";
import { TaskViewIcon } from "@/components/task/task-icons";
import { useSavedViewMutations } from "@/components/task/use-saved-views";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast";
import {
  taskSavedViewConfigsEqual,
  type TaskSavedViewConfig,
  type TaskSavedViewDto,
} from "@/lib/task-saved-view";
import { cn } from "@/lib/utils";

interface TaskSavedViewsProps {
  workspaceKey: string;
  currentConfig: TaskSavedViewConfig;
  views: TaskSavedViewDto[];
  defaultViewId: string | null;
  activeViewId: string | null;
  isLoading: boolean;
  enabled: boolean;
  canManageDefault: boolean;
  compact?: boolean;
  onApplyView: (view: TaskSavedViewDto, options?: { cleanUrl?: boolean }) => void;
  onClearActiveView: () => void;
}

type FormMode = "create" | "edit";

export function TaskSavedViews({
  workspaceKey,
  currentConfig,
  views,
  defaultViewId,
  activeViewId,
  isLoading,
  enabled,
  canManageDefault,
  compact = false,
  onApplyView,
  onClearActiveView,
}: TaskSavedViewsProps) {
  const { messages } = useI18n();
  const { toast } = useToast();
  const copy = messages.taskWorkspace.savedView;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingView, setEditingView] = useState<TaskSavedViewDto | null>(null);
  const [formName, setFormName] = useState("");
  const [formShared, setFormShared] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskSavedViewDto | null>(null);

  const mutations = useSavedViewMutations(workspaceKey, {
    createFailed: copy.createFailed,
    updateFailed: copy.updateFailed,
    deleteFailed: copy.deleteFailed,
  });
  const activeView = useMemo(
    () => activeViewId ? views.find((view) => view.id === activeViewId) ?? null : null,
    [activeViewId, views],
  );
  const activeViewDirty = Boolean(activeView && !taskSavedViewConfigsEqual(currentConfig, activeView.config));
  const busy = (
    mutations.createView.isPending ||
    mutations.updateView.isPending ||
    mutations.deleteView.isPending ||
    mutations.setDefaultView.isPending ||
    mutations.clearDefaultView.isPending
  );

  const openCreateForm = () => {
    setFormMode("create");
    setEditingView(null);
    setFormName("");
    setFormShared(false);
    setOpen(false);
  };

  const openEditForm = (view: TaskSavedViewDto) => {
    setFormMode("edit");
    setEditingView(view);
    setFormName(view.name);
    setFormShared(view.isShared);
    setOpen(false);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingView(null);
    setFormName("");
    setFormShared(false);
  };

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = formName.trim();
    if (!name) {
      toast(copy.nameRequired, { type: "error" });
      return;
    }
    try {
      if (formMode === "create") {
        const view = await mutations.createView.mutateAsync({
          workspaceKey,
          name,
          isShared: formShared,
          config: currentConfig,
        });
        toast(copy.createSuccess, { type: "success" });
        onApplyView(view);
      } else if (editingView) {
        const view = await mutations.updateView.mutateAsync({
          id: editingView.id,
          name,
          isShared: formShared,
        });
        toast(copy.updateSuccess, { type: "success" });
        if (activeViewId === view.id) onApplyView(view);
      }
      closeForm();
    } catch (error) {
      toast(error instanceof Error ? error.message : copy.updateFailed, { type: "error", sticky: true });
    }
  };

  const updateCurrentView = async (view: TaskSavedViewDto) => {
    try {
      const updated = await mutations.updateView.mutateAsync({
        id: view.id,
        config: currentConfig,
      });
      toast(copy.updateSuccess, { type: "success" });
      onApplyView(updated);
    } catch (error) {
      toast(error instanceof Error ? error.message : copy.updateFailed, { type: "error", sticky: true });
    }
  };

  const deleteView = async () => {
    if (!deleteTarget) return;
    try {
      await mutations.deleteView.mutateAsync(deleteTarget.id);
      toast(copy.deleteSuccess, { type: "success" });
      if (activeViewId === deleteTarget.id) onClearActiveView();
      setDeleteTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : copy.deleteFailed, { type: "error", sticky: true });
    }
  };

  const setDefaultView = async (view: TaskSavedViewDto) => {
    try {
      if (view.isDefault || defaultViewId === view.id) {
        await mutations.clearDefaultView.mutateAsync();
        toast(copy.defaultCleared, { type: "success" });
      } else {
        await mutations.setDefaultView.mutateAsync(view.id);
        toast(copy.defaultSaved, { type: "success" });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : copy.updateFailed, { type: "error", sticky: true });
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-task-saved-views-trigger="true"
        aria-label={copy.openMenu}
        title={copy.openMenu}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          featureToolbarButtonClass,
          (open || activeView) && featureToolbarButtonActiveClass,
          compact && "max-[767px]:h-9 max-[767px]:min-w-9 max-[767px]:gap-1 max-[767px]:px-2 max-[767px]:text-[length:var(--text-xs)] max-[359px]:h-8 max-[359px]:min-w-8 max-[359px]:px-1.5"
        )}
      >
        <TaskViewIcon mode={activeView?.config.viewMode ?? "list"} className="h-3.5 w-3.5" />
        <span className={compact ? "hidden truncate lg:inline" : featureToolbarLabelClass}>{copy.label}</span>
        {activeView && (
          <span className={cn(featureToolbarBadgeClass, compact ? "hidden max-w-28 truncate 2xl:inline" : undefined)}>
            {activeView.name}
          </span>
        )}
      </button>

      <FloatingPortal
        open={open}
        anchorRef={triggerRef}
        floatingRef={panelRef}
        placement="bottom"
        align="end"
        offset={4}
        preferredWidth={380}
        maxHeight={480}
        zIndex={140}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-2 pb-2">
          <p className="text-[length:var(--text-xs)] font-semibold text-[var(--color-text-primary)]">{copy.label}</p>
          <Button type="button" size="sm" onClick={openCreateForm} disabled={!enabled || busy}>
            {copy.create}
          </Button>
        </div>

        <div className="max-h-[360px] space-y-1 overflow-y-auto py-2">
          {isLoading ? (
            <p className="px-2 py-3 text-center text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{copy.loading}</p>
          ) : views.length === 0 ? (
            <p className="px-2 py-3 text-center text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{copy.empty}</p>
          ) : (
            views.map((view) => {
              const isActive = view.id === activeViewId;
              const isDefault = view.isDefault || defaultViewId === view.id;
              return (
                <div
                  key={view.id}
                  className={cn(
                    "rounded-[var(--radius-md)] border border-transparent px-2 py-2 transition-colors",
                    isActive ? "border-[var(--color-accent)]/25 bg-[var(--color-accent-light)]" : "hover:bg-[var(--color-bg-secondary)]"
                  )}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]">{view.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {view.isShared ? (
                          <span className={featureToolbarBadgeClass}>{copy.sharedBadge}</span>
                        ) : (
                          <span className={featureToolbarBadgeClass}>{copy.privateBadge}</span>
                        )}
                        {isDefault && <span className={featureToolbarBadgeClass}>{copy.defaultBadge}</span>}
                        {view.isOwner && <span className={featureToolbarBadgeClass}>{copy.ownerBadge}</span>}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant={isActive ? "secondary" : "ghost"} onClick={() => onApplyView(view)} disabled={busy}>
                      {copy.apply}
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => updateCurrentView(view)} disabled={!view.canManage || busy}>
                      {copy.updateCurrent}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => openEditForm(view)} disabled={!view.canManage || busy}>
                      {copy.edit}
                    </Button>
                    {canManageDefault && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setDefaultView(view)} disabled={!view.isShared || busy}>
                        {isDefault ? copy.clearDefault : copy.setDefault}
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(view)} disabled={!view.canManage || busy}>
                      {copy.delete}
                    </Button>
                  </div>
                  {canManageDefault && !view.isShared && (
                    <p className="mt-1 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)]">{copy.defaultOnlyShared}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </FloatingPortal>

      <Modal
        open={Boolean(formMode)}
        onClose={closeForm}
        title={formMode === "edit" ? copy.editTitle : copy.createTitle}
        size="sm"
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={closeForm} disabled={busy}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" form="task-saved-view-form" size="sm" disabled={busy || !formName.trim()}>
              {formMode === "edit" ? messages.common.save : copy.create}
            </Button>
          </>
        }
      >
        <form id="task-saved-view-form" onSubmit={handleFormSubmit} className="space-y-3">
          <label className="block text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
            <span>{copy.nameLabel}</span>
            <Input
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              placeholder={copy.namePlaceholder}
              className="mt-1"
              maxLength={120}
            />
          </label>
          <label className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={formShared}
              onChange={(event) => setFormShared(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-[var(--color-text-primary)]">{copy.sharedLabel}</span>
              <span className="block text-[var(--color-text-tertiary)]">{copy.sharedHint}</span>
            </span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={copy.deleteTitle}
        description={copy.deleteDescription.replace("{name}", deleteTarget?.name ?? "")}
        confirmLabel={copy.delete}
        cancelLabel={messages.common.cancel}
        variant="danger"
        busy={mutations.deleteView.isPending}
        onConfirm={deleteView}
        onCancel={() => setDeleteTarget(null)}
      />

      {activeView && activeViewDirty && (
        <div className="fixed bottom-4 left-1/2 z-[80] w-[min(92vw,560px)] -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 shadow-[var(--shadow-lg)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text-primary)]">{copy.dirtyTitle}</p>
              <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{copy.dirtyDescription.replace("{name}", activeView.name)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="ghost" onClick={() => onApplyView(activeView)} disabled={busy}>
                {copy.reset}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onClearActiveView} disabled={busy}>
                {copy.clearActive}
              </Button>
              <Button type="button" size="sm" onClick={() => updateCurrentView(activeView)} disabled={!activeView.canManage || busy}>
                {copy.updateCurrent}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
