"use client";

import { useEffect, useRef } from "react";

interface TaskSelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  "aria-label": string;
  onChange: (checked: boolean, meta: { shiftKey: boolean }) => void;
}

export function TaskSelectionCheckbox({
  checked,
  indeterminate = false,
  "aria-label": ariaLabel,
  onChange,
}: TaskSelectionCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  const shiftKeyRef = useRef(false);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      draggable={false}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.stopPropagation();
        shiftKeyRef.current = event.shiftKey;
        if (event.shiftKey) event.preventDefault();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        onChange(event.target.checked, { shiftKey: shiftKeyRef.current });
        shiftKeyRef.current = false;
      }}
      className="h-4 w-4 rounded accent-[var(--color-accent)]"
    />
  );
}
