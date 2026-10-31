import { X } from "lucide-react";

import { ChipLabel } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { Named } from "./useUnitEditDraft";

/** An option as the Add list names it: "Brick Wall (Large units only)", "Mist Form (Vampire only)". */
const optionLabel = (option: Named, about?: { warning: string; note: string }) => {
  const notes = [about?.warning ? "Large units only" : "", about?.note ?? ""].filter(Boolean);
  return notes.length ? `${option.name} (${notes.join(", ")})` : option.name;
};

/**
 * A list in the edit form (skills, specials, spells): the unit's entries, each removable, the picks
 * an advance left for later ("1 skill to choose", one fewer with ×), and Add.
 */
export default function EditListPicker({
  label,
  entries,
  options,
  onChange,
  pending = 0,
  onPendingChange,
  describe,
}: {
  label: string;
  entries: Named[];
  options: Named[];
  onChange: (next: Named[]) => void;
  /** Picks left to make on this list; only heroes and hired swords have them. */
  pending?: number;
  onPendingChange?: (next: number) => void;
  /** A warning for an entry (a Large unit's skill on another unit) and its note, shown with it. */
  describe?: (entry: Named) => { warning: string; note: string };
}) {
  const noun = label.toLowerCase().replace(/s$/, "");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {entries.map((entry) => {
          const { warning } = describe?.(entry) ?? { warning: "" };
          return (
            <ChipLabel
              key={entry.id}
              title={warning || undefined}
              className={cn(
                "min-h-[34px] gap-1 pr-1 text-[13px]",
                warning ? "text-danger" : "text-ink"
              )}
            >
              {entry.name}
              {warning ? <span className="text-xs">(Large units only)</span> : null}
              <button
                type="button"
                aria-label={`Remove ${entry.name}`}
                className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-ink"
                onClick={() => onChange(entries.filter((x) => x.id !== entry.id))}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </ChipLabel>
          );
        })}
        {pending > 0 && onPendingChange ? (
          <ChipLabel className="min-h-[34px] gap-1 pr-1 text-[13px] text-accent-text">
            {pending} {noun}
            {pending === 1 ? "" : "s"} to choose
            <button
              type="button"
              aria-label={`One ${noun} fewer to choose`}
              className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-ink"
              onClick={() => onPendingChange(pending - 1)}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </ChipLabel>
        ) : null}
        <select
          aria-label={`Add ${label.toLowerCase()}`}
          value=""
          onChange={(event) => {
            const picked = options.find((option) => option.id === Number(event.target.value));
            if (picked) onChange([...entries, picked]);
          }}
          className="h-[34px] border border-dashed border-strong bg-transparent px-2 text-[13px] font-bold text-accent-text"
        >
          <option value="">Add {noun}…</option>
          {options
            .filter((option) => !entries.some((x) => x.id === option.id))
            .map((option) => (
              <option key={option.id} value={option.id}>
                {optionLabel(option, describe?.(option))}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
