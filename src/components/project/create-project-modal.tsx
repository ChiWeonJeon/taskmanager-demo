"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast";
import { useI18n } from "@/components/shared/locale-provider";

interface Props {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [keyManuallySet, setKeyManuallySet] = useState(false);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    if (!keyManuallySet) {
      setKey(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
    }
  }, [keyManuallySet]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), key: key.trim(), description: description.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || messages.createProjectModal.createError);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["my-projects"] });
      toast(messages.createProjectModal.createSuccess, { type: "success" });
      onClose();
    },
    onError: (err: Error) => toast(err.message, { type: "error", sticky: true }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;
    createMutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={messages.createProjectModal.title}
      size="sm"
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {messages.createProjectModal.name} <span className="text-[var(--color-danger)]">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={messages.createProjectModal.namePlaceholder}
              inputSize="lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {messages.createProjectModal.key} <span className="text-[var(--color-danger)]">*</span>
              <span className="ml-1 text-[var(--color-text-tertiary)] font-normal">{messages.createProjectModal.keyHint}</span>
            </label>
            <Input
              value={key}
              onChange={(e) => {
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
                setKeyManuallySet(true);
              }}
              placeholder={messages.createProjectModal.keyPlaceholder}
              inputSize="lg"
              className="font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{messages.createProjectModal.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={messages.createProjectModal.descriptionPlaceholder}
              rows={3}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>{messages.common.cancel}</Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || !key.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? messages.common.createInProgress : messages.common.create}
            </Button>
          </div>
        </form>
    </Modal>
  );
}
