import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import SearchablePickerSection from "@/features/bestiary/components/SearchablePickerSection";

import type { Restriction } from "@/features/items/types/item-types";
import type { HirelingRestrictions } from "../../hooks/useHirelingRestrictions";

const NOTHING_PICKED: { id: number; name: string; description: string }[] = [];

/** What the field edits: the chosen restrictions with their notes, and what may be picked. */
export type RestrictionsPicker = Pick<
  HirelingRestrictions,
  "available" | "rows" | "add" | "remove" | "setNote"
>;

/**
 * Who may hire the entry (or buy a beast at a price): restrictions picked from the campaign's,
 * each with an optional note.
 */
export default function HirelingRestrictionsField({
  restrictions,
}: {
  restrictions: RestrictionsPicker;
}) {
  // The picker offers every restriction each time: one can be listed again with another note.
  const options = restrictions.available.map((restriction) => ({
    id: restriction.id,
    name: restriction.restriction,
    description: restriction.type,
    restriction,
  }));
  return (
    <div className="flex flex-col gap-2">
      <SearchablePickerSection
        label="Restrictions"
        placeholder="Search restrictions..."
        items={options}
        selected={NOTHING_PICKED as typeof options}
        onSelect={(option) => restrictions.add(option.restriction as Restriction)}
        onRemove={() => undefined}
      />
      {restrictions.rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label="Chosen restrictions">
          {restrictions.rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">
                {row.restriction.restriction}
                <span className="ml-1 text-xs text-muted-foreground">({row.restriction.type})</span>
              </span>
              <Input
                value={row.note}
                onChange={(event) => restrictions.setNote(row.key, event.target.value)}
                placeholder="Note (optional)"
                aria-label={`Note for ${row.restriction.restriction}`}
                className="h-8 w-48 text-xs"
              />
              <button
                type="button"
                onClick={() => restrictions.remove(row.key)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${row.restriction.restriction}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
