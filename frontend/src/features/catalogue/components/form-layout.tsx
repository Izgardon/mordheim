import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

import { FieldError } from "@components/field-error";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { cn } from "@/lib/utils";

/**
 * Where a catalogue form sits: inline on its catalogue page (small captions in a grid), or in a
 * dialog on the warband pages (stacked fields whose labels name their inputs).
 */
export type FormLayout = "inline" | "dialog";

const FOCUS_GLOW =
  "focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

/** A form's long-text box (description, fluff) in each layout. */
export const TEXTAREA_CLASS: Record<FormLayout, string> = {
  inline: `min-h-[80px] w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] ${FOCUS_GLOW}`,
  dialog: `min-h-[120px] w-full rounded-2xl border border-input/80 bg-background/60 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] placeholder:text-muted-foreground/60 placeholder:italic ${FOCUS_GLOW}`,
};

/** The grid an inline form lays its short fields out in. */
export const INLINE_GRID_CLASS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";

/** The id an input carries: a dialog's label points at its input, an inline caption doesn't. */
export const fieldId = (layout: FormLayout, id: string) => (layout === "dialog" ? id : undefined);

type CatalogueFieldProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  layout: FormLayout;
  label: ReactNode;
  /** The input the dialog's label names. */
  htmlFor?: string;
  children: ReactNode;
};

/** One field: a small caption over the input inline, a Label tied to the input in a dialog. */
export function CatalogueField({
  layout,
  label,
  htmlFor,
  className,
  children,
  ...rest
}: CatalogueFieldProps) {
  if (layout === "inline") {
    return (
      <div className={className} {...rest}>
        <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
        {children}
      </div>
    );
  }
  return (
    <div className={cn("space-y-2", className)} {...rest}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

type CatalogueNameFieldProps = {
  layout: FormLayout;
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** The server's refusal of the name (e.g. 400 `duplicate_entry`). */
  error?: string;
  placeholder: string;
  required?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "placeholder">;

/** A catalogue entry's Name, with its refusal under it. */
export function CatalogueNameField({
  layout,
  id,
  value,
  onChange,
  error,
  placeholder,
  required,
  ...inputProps
}: CatalogueNameFieldProps) {
  return (
    <CatalogueField layout={layout} label="Name" htmlFor={id}>
      <Input
        id={fieldId(layout, id)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        placeholder={placeholder}
        required={required}
        {...inputProps}
      />
      <FieldError message={error} />
    </CatalogueField>
  );
}

type CatalogueDescriptionFieldProps = {
  layout: FormLayout;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

/** A skill's, spell's or special's Description (required in a dialog). */
export function CatalogueDescriptionField({
  layout,
  id,
  value,
  onChange,
  placeholder,
  className,
}: CatalogueDescriptionFieldProps) {
  const isDialog = layout === "dialog";
  return (
    <CatalogueField layout={layout} label="Description" htmlFor={id} className={className}>
      <textarea
        id={fieldId(layout, id)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={isDialog ? undefined : 2}
        className={TEXTAREA_CLASS[layout]}
        required={isDialog}
      />
    </CatalogueField>
  );
}
