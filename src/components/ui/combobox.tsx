"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { findReferenceOption, optionMatchesValue } from "@/lib/reference-options";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  color?: string | null;
  aliases?: string[];
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  /** Render the trigger element (receives the currently selected option or undefined) */
  renderTrigger: (option: ComboboxOption | undefined, open: boolean) => React.ReactNode;
  /** Width of the dropdown panel in Tailwind or inline style */
  dropdownWidth?: string;
}

/**
 * Searchable dropdown (combobox) shared across all task views.
 * Renders a custom trigger and a filterable options list.
 * Uses a portal to avoid clipping by overflow:hidden/auto parents (e.g. table).
 * Supports keyboard navigation: ArrowDown/ArrowUp moves highlight, Enter selects.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  className,
  triggerClassName,
  renderTrigger,
  dropdownWidth = "w-48",
}: ComboboxProps) {
  const { messages } = useI18n();
  const effectivePlaceholder = placeholder ?? messages.commonUi.comboboxSearchPlaceholder;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = findReferenceOption(options, value);
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLButtonElement>("button");
    items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 10);
    return () => clearTimeout(id);
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClose(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [open]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
    },
    [onChange]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
          handleSelect(filtered[highlightedIndex].value);
        }
      }
    },
    [filtered, highlightedIndex, handleSelect]
  );

  const dropdown = (
    <FloatingPortal
      open={open}
      anchorRef={triggerRef}
      floatingRef={dropdownRef}
      placement="bottom"
      align="start"
      offset={4}
      zIndex={130}
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-md)]",
        dropdownWidth
      )}
    >
      {/* Search input */}
      <div className="border-b border-[var(--color-border)] p-1.5">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightedIndex(-1); }}
          onKeyDown={handleInputKeyDown}
          placeholder={effectivePlaceholder}
          className="w-full rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs outline-none placeholder:text-[var(--color-text-tertiary)] text-[var(--color-text-primary)]"
        />
      </div>

      {/* Options list */}
      <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-[var(--color-text-tertiary)]">{messages.commonUi.comboboxNoResults}</p>
        ) : (
          filtered.map((opt, index) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors",
                optionMatchesValue(opt, value)
                  ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  : index === highlightedIndex
                  ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
                  : "hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
              )}
            >
              {opt.color && (
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {opt.label}
            </button>
          ))
        )}
      </div>
    </FloatingPortal>
  );

  return (
    <div className={cn("relative inline-block", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setSearch("");
          setHighlightedIndex(-1);
          setOpen((prev) => !prev);
        }}
        className={cn(
          "inline-flex max-w-full cursor-pointer items-center rounded-[var(--radius-sm)] border border-transparent transition-colors focus-visible:border-[var(--color-accent)] focus-visible:bg-[var(--color-accent)]/8 focus-visible:outline-none",
          triggerClassName
        )}
      >
        {renderTrigger(selected, open)}
      </button>

      {dropdown}
    </div>
  );
}
