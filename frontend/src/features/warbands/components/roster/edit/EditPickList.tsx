import type { ReactNode } from "react";
import { X } from "lucide-react";

import { ChipLabel } from "@/components/ui/chip";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";

import type { Named } from "./useUnitEditDraft";

/**
 * A list in the edit form (skills, specials, spells) on the searchable select: the unit's entries
 * with their subtitles, each removable, the picks an advance left for later ("1 skill to choose",
 * one fewer with ×), and Add.
 */
export default function EditPickList({
  title,
  noun,
  plural = `${noun}s`,
  entries,
  options,
  known = [],
  onChange,
  pending = 0,
  onPendingChange,
}: {
  /** The list's heading (its label and icon). */
  title: ReactNode;
  /** "skill", "spell", "special". */
  noun: string;
  /** "boons and banes": when adding "s" won't do. */
  plural?: string;
  entries: Named[];
  /** What Add offers. */
  options: SearchOption[];
  /** Rows for the chips of entries Add doesn't offer (one from outside the campaign he has). */
  known?: SearchOption[];
  onChange: (next: Named[]) => void;
  /** Picks left to make on this list; only heroes and hired swords have them. */
  pending?: number;
  onPendingChange?: (next: number) => void;
}) {
  const byId = new Map([...known, ...options].map((option) => [option.id, option]));
  const values = entries.map(
    (entry): SearchOption =>
      byId.get(entry.id) ?? { id: entry.id, title: entry.name, subtitle: entry.type ?? undefined }
  );
  return (
    <div className="flex flex-col gap-1.5">
      {title}
      <SearchMultiSelect
        values={values}
        options={options}
        addLabel={`Add ${noun}`}
        placeholder={`Search ${plural}`}
        emptyText={`No ${noun} matches.`}
        onChange={(next) =>
          onChange(
            next.map(
              (option) =>
                entries.find((entry) => entry.id === option.id) ?? {
                  id: Number(option.id),
                  name: option.title,
                }
            )
          )
        }
      >
        {pending > 0 && onPendingChange ? (
          <ChipLabel className="min-h-[38px] gap-1 pr-1 text-[13px] text-accent-text">
            {pending} {pending === 1 ? noun : plural} to choose
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
      </SearchMultiSelect>
    </div>
  );
}
