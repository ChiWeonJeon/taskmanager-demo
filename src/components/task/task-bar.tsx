"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/locale-provider";

interface TaskBarProps {
  onCreateTask: (title: string) => void;
  isLoading?: boolean;
}

export function TaskBar({ onCreateTask, isLoading }: TaskBarProps) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { messages } = useI18n();

  const handleSubmit = () => {
    if (isLoading) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateTask(trimmed);
    setTitle("");
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex w-full min-w-0 gap-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={messages.taskBar.placeholder}
        autoComplete="off"
        aria-busy={isLoading}
        className="h-9 min-w-0 flex-1 rounded-full px-3 text-[length:var(--text-sm)]"
      />
      <Button onClick={handleSubmit} disabled={!title.trim() || isLoading} size="sm" className="h-9 shrink-0 rounded-full px-3 text-[length:var(--text-sm)]">
        {messages.taskBar.create}
      </Button>
    </div>
  );
}
