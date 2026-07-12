"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// Lightweight confirmation dialog shared across admin screens. Replaces ad-hoc
// `window.confirm(...)` calls so destructive actions (delete) and unsaved-change
// guards present a consistent, themable, i18n-driven UI. All visible strings are
// passed in by the caller (so they flow through the language pack).

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Optional body / description text. */
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** "danger" renders the confirm button in the destructive style. */
  variant?: "default" | "danger";
  /** Disables the confirm button (e.g. while a delete mutation is pending). */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {null}
    </Modal>
  );
}
