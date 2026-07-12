"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/shared/locale-provider";
import { Modal } from "@/components/ui/modal";

interface ProjectGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
}

interface Props {
  onClose: () => void;
  onCreated: (group: ProjectGroup) => void;
}

export function CreateGroupModal({ onClose, onCreated }: Props) {
  const { messages } = useI18n();
  const m = messages.createGroupModal;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError(m.nameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/project-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || undefined, description: description.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? m.createFailed);
        return;
      }
      onCreated(body as ProjectGroup);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={m.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            {m.cancel}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? m.creating : m.create}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{m.nameLabel}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={m.namePlaceholder} />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{m.slugLabel}</span>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={m.slugPlaceholder} />
        </label>
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)]">{m.descriptionLabel}</span>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={m.descriptionPlaceholder} />
        </label>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
