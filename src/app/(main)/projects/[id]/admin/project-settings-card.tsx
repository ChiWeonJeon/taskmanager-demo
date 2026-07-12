"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IssueTypeOption, ResolvedProjectConfig } from "@/components/task/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast";
import { useI18n } from "@/components/shared/locale-provider";

interface ProjectSettingsCardProps {
  project: {
    id: string;
    name: string;
    key: string;
    isPersonal: boolean;
  };
  issueCount: number;
  canManageProject: boolean;
}

async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed.");
  }

  return response.json() as Promise<T>;
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function ProjectSettingsCard({
  project,
  issueCount,
  canManageProject,
}: ProjectSettingsCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.projectAdminPage.settings.card;

  const [name, setName] = useState(project.name);
  const [keyValue, setKeyValue] = useState(project.key);
  const [enabledIssueTypeIds, setEnabledIssueTypeIds] = useState<string[]>([]);
  const [defaultIssueTypeId, setDefaultIssueTypeId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleteConfirmationKey, setDeleteConfirmationKey] = useState("");

  const issueTypesQuery = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types"],
    queryFn: () => fetchJsonOrThrow<IssueTypeOption[]>("/api/issue-types"),
    enabled: canManageProject,
  });

  const projectConfigQuery = useQuery<ResolvedProjectConfig>({
    queryKey: ["project-config", project.id],
    queryFn: () =>
      fetchJsonOrThrow<ResolvedProjectConfig>(`/api/projects/${project.id}/config`),
    enabled: canManageProject,
  });

  useEffect(() => {
    const config = projectConfigQuery.data;
    if (!config) return;

    const nextEnabledIds = config.enabledIssueTypes.map((issueType) => issueType.id);
    setEnabledIssueTypeIds(nextEnabledIds);
    setDefaultIssueTypeId(config.defaultIssueTypeId ?? nextEnabledIds[0] ?? "");
  }, [projectConfigQuery.data]);

  const normalizedKey = useMemo(() => keyValue.trim().toUpperCase(), [keyValue]);
  const sortedEnabledIssueTypeIds = useMemo(
    () => [...enabledIssueTypeIds].sort(),
    [enabledIssueTypeIds],
  );
  const initialEnabledIssueTypeIds = useMemo(
    () =>
      [...(projectConfigQuery.data?.enabledIssueTypes.map((issueType) => issueType.id) ?? [])].sort(),
    [projectConfigQuery.data],
  );
  const initialDefaultIssueTypeId = projectConfigQuery.data?.defaultIssueTypeId ?? "";
  const isDirty =
    name.trim() !== project.name
    || normalizedKey !== project.key
    || defaultIssueTypeId !== initialDefaultIssueTypeId
    || !arraysEqual(sortedEnabledIssueTypeIds, initialEnabledIssueTypeIds);
  const deleteKeyMatches = deleteConfirmationKey.trim().toUpperCase() === project.key;

  const selectedIssueTypes = useMemo(
    () =>
      (issueTypesQuery.data ?? []).filter((issueType) =>
        enabledIssueTypeIds.includes(issueType.id),
      ),
    [enabledIssueTypeIds, issueTypesQuery.data],
  );

  const resetDeleteFlow = useCallback(() => {
    setDeleteStep(0);
    setDeleteAcknowledged(false);
    setDeleteConfirmationKey("");
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (isDeleting) return;
    resetDeleteFlow();
    setDeleteModalOpen(false);
  }, [isDeleting, resetDeleteFlow]);


  async function handleSaveSettings() {
    if (!canManageProject || isSaving) return;

    if (!enabledIssueTypeIds.length) {
      toast(m.selectAtLeastOne, { type: "error", sticky: true });
      return;
    }

    if (!defaultIssueTypeId || !enabledIssueTypeIds.includes(defaultIssueTypeId)) {
      toast(m.selectDefaultFromEnabled, {
        type: "error",
        sticky: true,
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          key: normalizedKey,
          enabledIssueTypeIds,
          defaultIssueTypeId,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || m.saveFailed);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project-config", project.id] }),
        queryClient.invalidateQueries({ queryKey: ["work-items", "project", project.key] }),
      ]);

      toast(m.saveSuccess, { type: "success" });
      router.replace(`/projects/${normalizedKey}/admin/settings`);
      router.refresh();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : m.saveFailed,
        {
          type: "error",
          sticky: true,
        },
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteProject() {
    if (
      !canManageProject
      || project.isPersonal
      || isDeleting
      || !deleteAcknowledged
      || !deleteKeyMatches
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmCascade: true,
          confirmationKey: deleteConfirmationKey.trim().toUpperCase(),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || m.deleteFailed);
      }

      queryClient.setQueryData<{ id: string }[] | undefined>(
        ["my-projects"],
        (previous) => previous?.filter((candidate) => candidate.id !== project.id),
      );
      queryClient.removeQueries({ queryKey: ["work-items", "project", project.key] });
      queryClient.removeQueries({ queryKey: ["trash", project.key] });
      queryClient.removeQueries({ queryKey: ["project-members", project.id] });
      queryClient.removeQueries({ queryKey: ["project-config", project.id] });
      await queryClient.invalidateQueries({ queryKey: ["my-projects"] });

      toast(
        m.deletedCount.replace("{count}", String(body.deletedWorkItemCount ?? issueCount)),
        { type: "warning", sticky: true },
      );
      router.replace("/projects");
      router.refresh();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : m.deleteFailed,
        {
          type: "error",
          sticky: true,
        },
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function openDeleteModal() {
    resetDeleteFlow();
    setDeleteStep(1);
    setDeleteModalOpen(true);
  }

  function toggleIssueType(issueTypeId: string) {
    setEnabledIssueTypeIds((current) => {
      if (current.includes(issueTypeId)) {
        if (current.length === 1) return current;

        const next = current.filter((currentIssueTypeId) => currentIssueTypeId !== issueTypeId);
        if (defaultIssueTypeId === issueTypeId) {
          setDefaultIssueTypeId(next[0] ?? "");
        }
        return next;
      }

      return [...current, issueTypeId];
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {m.basicTitle}
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {m.basicDescription}
          </p>
        </div>

        {!canManageProject ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
            <code>project:manage</code>{m.permissionNoteSuffix}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {m.projectNameLabel}
                </span>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={m.projectNamePlaceholder}
                  className="h-9 text-[length:var(--text-sm)]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {m.keyLabel}
                </span>
                <Input
                  value={keyValue}
                  onChange={(event) => setKeyValue(event.target.value.toUpperCase())}
                  placeholder={m.keyPlaceholder}
                  className="h-9 font-mono text-[length:var(--text-sm)]"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2">
              <div className="text-xs text-[var(--color-text-secondary)]">
                {m.routeFormatPrefix} <code>/projects/{normalizedKey || project.key}/...</code>
              </div>
              <Button
                size="sm"
                onClick={handleSaveSettings}
                disabled={!isDirty || !name.trim() || !normalizedKey || isSaving}
              >
                {isSaving ? m.saving : m.save}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {m.issueTypeTitle}
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {m.issueTypeDescription}
          </p>
        </div>

        {!canManageProject ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
            <code>project:manage</code>{m.permissionNoteSuffix}
          </div>
        ) : issueTypesQuery.isLoading || projectConfigQuery.isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)]"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {m.defaultIssueType}
              </label>
              <select
                value={defaultIssueTypeId}
                onChange={(event) => setDefaultIssueTypeId(event.target.value)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
              >
                {selectedIssueTypes.map((issueType) => (
                  <option key={issueType.id} value={issueType.id}>
                    {issueType.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(issueTypesQuery.data ?? []).map((issueType) => {
                const checked = enabledIssueTypeIds.includes(issueType.id);
                const isLastEnabled = checked && enabledIssueTypeIds.length === 1;

                return (
                  <label
                    key={issueType.id}
                    className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIssueType(issueType.id)}
                      disabled={isLastEnabled}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {issueType.name}
                        </span>
                        {issueType.color && (
                          <Badge color={issueType.color}>{issueType.color}</Badge>
                        )}
                        {defaultIssueTypeId === issueType.id && (
                          <Badge variant="accent">{m.defaultBadge}</Badge>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                        {issueType.fieldSchema?.name ?? m.noFieldSchema} /{" "}
                        {issueType.statusSchema?.name ?? m.noStatusSchema}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-3">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                {m.activeSelection}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedIssueTypes.length > 0 ? (
                  selectedIssueTypes.map((issueType) => (
                    <Badge
                      key={issueType.id}
                      color={issueType.color ?? undefined}
                      variant={defaultIssueTypeId === issueType.id ? "accent" : "default"}
                    >
                      {issueType.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {m.noIssueTypesSelected}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/40 bg-[var(--color-danger-light)]/35 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-danger)]">
              {m.deleteTitle}
            </h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {m.deleteDescription}
            </p>
            <p className="mt-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">
              {m.projectKeyLabel} <span className="font-mono font-semibold">{project.key}</span>
              <span className="mx-2 text-[var(--color-text-tertiary)]">|</span>
              {m.existingWorkItemsLabel} <span className="font-semibold">{issueCount}</span>
            </p>
          </div>

          {project.isPersonal ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
              {m.personalCannotDelete}
            </div>
          ) : !canManageProject ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
              <code>project:manage</code>{m.deletePermissionNoteSuffix}
            </div>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={openDeleteModal}
              className="shrink-0"
            >
              {m.deleteButton}
            </Button>
          )}
        </div>
      </div>

      {deleteModalOpen && (
        <Modal
          open
          onClose={closeDeleteModal}
          title={<span className="text-[var(--color-danger)]">{m.modalTitle}</span>}
          description={m.modalDescription}
          footer={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={closeDeleteModal}>
                {m.cancel}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDeleteProject}
                disabled={!deleteAcknowledged || !deleteKeyMatches || isDeleting}
              >
                {isDeleting ? m.deleting : m.deleteButton}
              </Button>
            </>
          }
        >
            <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-light)]/40 px-3 py-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">
              <p>
                {m.modalProjectLabel} <span className="font-mono font-semibold">{project.key}</span>
              </p>
              <p className="mt-1">{m.modalImpact.replace("{count}", String(issueCount))}</p>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                <p className="text-xs font-semibold text-[var(--color-danger)]">
                  {m.step1}
                </p>
                <label className="mt-2 flex items-start gap-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={deleteAcknowledged}
                    onChange={(event) => setDeleteAcknowledged(event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded accent-[var(--color-danger)]"
                  />
                  <span>
                    {m.step1Ack}
                  </span>
                </label>
                {deleteStep < 2 && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={!deleteAcknowledged}
                      onClick={() => setDeleteStep(2)}
                    >
                      {m.continue}
                    </Button>
                  </div>
                )}
              </div>

              {deleteStep >= 2 && (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                  <p className="text-xs font-semibold text-[var(--color-danger)]">
                    {m.step2}
                  </p>
                  <p className="mt-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">
                    {m.step2Instruction.split("{key}")[0]}
                    <span className="font-mono font-semibold">{project.key}</span>
                    {m.step2Instruction.split("{key}")[1]}
                  </p>
                  <Input
                    value={deleteConfirmationKey}
                    onChange={(event) => setDeleteConfirmationKey(event.target.value.toUpperCase())}
                    placeholder={project.key}
                    className="mt-3 h-9 font-mono text-[length:var(--text-sm)]"
                  />
                </div>
              )}
            </div>

        </Modal>
      )}
    </div>
  );
}
