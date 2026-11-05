import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { EditorWarning } from "../types/editor-types";

/** A field's small caption. */
export const CAPTION = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** A labelled field: the caption over its input. */
export function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className={CAPTION}>{label}</span>
      {children}
    </label>
  );
}

/** A whole number or nothing: "" reads as null, as the server keeps "none in the book". */
export const numberOrNull = (text: string) => {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
};

export const textOf = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** A small box for a number that may be left empty ("none"): its text, kept as typed. */
export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Input
        inputMode="numeric"
        inputSize="sm"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value.replace(/[^\d-]/g, ""))}
      />
    </Field>
  );
}

/** The server's warnings for what is on screen; each still lets the save through. */
export function Warnings({ warnings }: { warnings: EditorWarning[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {warnings.map((warning) => (
        <li key={`${warning.key}-${warning.text}`} className="text-xs font-semibold text-danger">
          {warning.text}
        </li>
      ))}
    </ul>
  );
}

/** A form's foot: its refusal, Cancel (when it has one) and its Save. */
export function SaveRow({
  label,
  pending,
  error,
  disabled,
  onSave,
  onCancel,
  children,
}: {
  label: string;
  pending: boolean;
  error: string;
  disabled?: boolean;
  onSave: () => void;
  onCancel?: () => void;
  /** At the left: Delete. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="m-0 text-xs font-semibold text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <span className="ml-auto flex gap-2">
          {onCancel ? (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button size="sm" onClick={onSave} disabled={pending || disabled}>
            {pending ? "Saving..." : label}
          </Button>
        </span>
      </div>
    </div>
  );
}

/** A form opened inside its section, picked out. */
export const FORM_BOX = "flex flex-col gap-3 border border-accent-line bg-surface p-3";
