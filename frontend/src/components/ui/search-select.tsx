import * as React from "react";
import { ChevronDown, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { SearchCombobox, type SearchComboboxProps, type SearchOption } from "./search-combobox";

export { SearchCombobox, filterOptions, type SearchOption } from "./search-combobox";

type PickerProps = Omit<SearchComboboxProps, "onPick" | "onDismiss" | "inline" | "autoFocus">;

/** An option's lines; `clamp` ends each in "…" where it runs out of room, the full text in its title. */
function OptionText({ option, clamp = false }: { option: SearchOption; clamp?: boolean }) {
  const line = (text: string) => (clamp ? { title: text, className: "truncate" } : {});
  return (
    <span className="flex min-w-0 flex-col">
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-[13px] font-bold [&_svg]:shrink-0",
          option.warning ? "text-text2" : "text-ink"
        )}
      >
        {option.icon}
        <span {...line(option.title)}>{option.title}</span>
        {option.aside}
      </span>
      {option.subtitle ? (
        <span
          {...line(option.subtitle)}
          className={cn("text-[11px] font-medium text-muted-foreground", clamp && "truncate")}
        >
          {option.subtitle}
        </span>
      ) : null}
      {option.warning ? (
        <span
          {...line(option.warning)}
          className={cn("text-[11px] font-semibold text-danger", clamp && "truncate")}
        >
          {option.warning}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Picks one entry (a race, a skill group, a warband type): the value shows its title and subtitle,
 * pressing it opens the search in its place, and `clearLabel` adds a × that empties it.
 */
export function SearchSelect({
  value,
  onChange,
  clearLabel,
  disabled,
  ...picker
}: PickerProps & {
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  clearLabel?: string;
  disabled?: boolean;
}) {
  const [searching, setSearching] = React.useState(false);
  if (!disabled && (searching || !value)) {
    return (
      <SearchCombobox
        {...picker}
        autoFocus={searching}
        onPick={(option) => {
          onChange(option);
          setSearching(false);
        }}
        onDismiss={value ? () => setSearching(false) : undefined}
      />
    );
  }
  return (
    <div
      className={cn("flex min-h-9 items-stretch border border-strong bg-page", picker.className)}
    >
      <button
        type="button"
        id={picker.id}
        disabled={disabled}
        aria-label={value ? `${picker.label}: ${value.title}` : picker.label}
        onClick={() => setSearching(true)}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60"
      >
        {value ? <OptionText option={value} /> : <span className="text-sm text-faint">None</span>}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {clearLabel && value && !disabled ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onChange(null)}
          className="flex w-9 shrink-0 items-center justify-center border-l border-line text-muted-foreground hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** A picked entry in a multi-select: its title and subtitle, and × to take it out. */
export function SelectedChip({
  option,
  onRemove,
  extra,
  className,
}: {
  option: SearchOption;
  onRemove?: () => void;
  /** Beside the text: a quantity. */
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-[38px] max-w-[200px] items-center gap-1 border border-border bg-surface py-1 pl-2.5",
        onRemove ? "pr-0.5" : "pr-2.5",
        option.warning && "border-danger-line",
        className
      )}
    >
      <OptionText option={option} clamp />
      {extra}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${option.title}`}
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * Picks several entries (skills, spells, specials): the picked ones as chips with their subtitles,
 * then Add, which opens the search in its place and stays open for the next pick.
 */
export function SearchMultiSelect({
  values,
  onChange,
  addLabel,
  children,
  chipClassName,
  chipExtra,
  ...picker
}: Omit<PickerProps, "label"> & {
  values: SearchOption[];
  onChange: (next: SearchOption[]) => void;
  /** The add button's text and the search's name ("Add skill"). */
  addLabel: string;
  /** More chips after the picked ones (picks an advance left to make). */
  children?: React.ReactNode;
  chipClassName?: string;
  /** More inside a picked chip (a quantity). */
  chipExtra?: (option: SearchOption) => React.ReactNode;
}) {
  const [adding, setAdding] = React.useState(false);
  const free = picker.options.filter((option) => !values.some((value) => value.id === option.id));
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {values.map((value) => (
        <SelectedChip
          key={value.id}
          option={value}
          className={chipClassName}
          extra={chipExtra?.(value)}
          onRemove={() => onChange(values.filter((other) => other.id !== value.id))}
        />
      ))}
      {children}
      {adding ? (
        <SearchCombobox
          {...picker}
          label={addLabel}
          options={free}
          autoFocus
          className={cn("w-full min-[520px]:w-80", picker.className)}
          onPick={(option) => onChange([...values, option])}
          onDismiss={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-[38px] items-center gap-1.5 border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </div>
  );
}
