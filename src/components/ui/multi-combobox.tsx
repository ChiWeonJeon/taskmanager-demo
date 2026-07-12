"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { CheckSmallIcon } from "@/components/task/task-icons";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { getReferenceOptionAliases, optionMatchesValue } from "@/lib/reference-options";
import { cn } from "@/lib/utils";
import type { ComboboxOption } from "@/components/ui/combobox";

interface MultiComboboxProps {
  options: ComboboxOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  renderTrigger: (selected: ComboboxOption[], open: boolean) => React.ReactNode;
  dropdownWidth?: string;
  disabled?: boolean;
}

export function MultiCombobox({
  options,
  values,
  onChange,
  placeholder,
  className,
  triggerClassName,
  renderTrigger,
  dropdownWidth = "w-56",
  disabled = false,
}: MultiComboboxProps) {
  const { messages } = useI18n();
  const effectivePlaceholder = placeholder ?? messages.commonUi.comboboxSearchPlaceholder;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = options.filter((option) => values.some((value) => optionMatchesValue(option, value)));
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 10);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClose(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleValue = useCallback(
    (val: string) => {
      const option = options.find((entry) => entry.value === val);
      const aliases = option ? getReferenceOptionAliases(option) : [val];
      const next = new Set(values);
      const hasValue = aliases.some((alias) => next.has(alias));
      for (const alias of aliases) next.delete(alias);
      if (!hasValue) next.add(val);
      onChange(Array.from(next));
    },
    [onChange, options, values],
  );

  const dropdown = (
    <FloatingPortal
      open={open}
      anchorRef={triggerRef}
      floatingRef={panelRef}
      placement="bottom"
      align="start"
      offset={4}
      zIndex={130}
            className={cn(
              "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-md)]",
              dropdownWidth,
            )}
          >
            <div className="border-b border-[var(--color-border)] p-1.5">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={effectivePlaceholder}
                className="w-full rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs outline-none placeholder:text-[var(--color-text-tertiary)] text-[var(--color-text-primary)]"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-[var(--color-text-tertiary)]">
                  {messages.commonUi.comboboxNoResults}
                </p>
              ) : (
                filtered.map((opt) => {
                  const checked = values.some((value) => optionMatchesValue(opt, value));
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        toggleValue(opt.value);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors",
                        checked
                          ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                          : "hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border",
                          checked
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                            : "border-[var(--color-border)] bg-[var(--color-bg-primary)]",
                        )}
                      >
                        {checked && <CheckSmallIcon className="h-3 w-3" />}
                      </span>
                      {opt.color && (
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: opt.color }}
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </FloatingPortal>
  );

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setSearch("");
          setOpen((prev) => !prev);
        }}
        className={cn(
          "inline-flex max-w-full cursor-pointer items-center rounded-[var(--radius-sm)] border border-transparent transition-colors focus-visible:border-[var(--color-accent)] focus-visible:outline-none",
          disabled && "cursor-not-allowed opacity-60",
          triggerClassName,
        )}
      >
        {renderTrigger(selected, open)}
      </button>
      {dropdown}
    </div>
  );
}
