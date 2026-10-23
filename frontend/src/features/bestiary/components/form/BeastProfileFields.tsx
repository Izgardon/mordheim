import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { StatsField } from "./bestiary-core-fields";

import type { BestiaryEntryFormState } from "../../hooks/useBestiaryEntryForm";

const CHECKBOX_CLASS = "h-4 w-4 rounded border-input";

/**
 * The beast's profile and what its kind adds: "Has a profile" (off, the stats hide and are saved
 * empty), a mount's "Rating bonus for the rider", and a creature's "Gains experience".
 */
export default function BeastProfileFields({ form }: { form: BestiaryEntryFormState }) {
  const { values, change, fieldErrors } = form;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.has_profile}
          onChange={(event) => change({ has_profile: event.target.checked })}
          className={CHECKBOX_CLASS}
        />
        Has a profile
      </label>
      {values.has_profile ? (
        <div className="flex flex-col gap-1">
          <StatsField values={values} onChange={change} />
          <FieldError message={fieldErrors.armour_save} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No profile: its stats are cleared when you save, and the pages say &ldquo;No
          profile&rdquo;. Tick it again to give it one, starting from empty stats.
        </p>
      )}

      {values.kind === "mount" ? (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="bestiary-rating-bonus">Rating bonus for the rider</Label>
          <Input
            id="bestiary-rating-bonus"
            type="number"
            min={0}
            step={1}
            value={values.rating_bonus}
            onChange={(event) => change({ rating_bonus: event.target.value })}
            aria-invalid={Boolean(fieldErrors.rating_bonus)}
            placeholder="e.g. 5"
          />
          <FieldError message={fieldErrors.rating_bonus} />
        </div>
      ) : null}

      {values.kind === "creature" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.gains_xp}
            onChange={(event) => change({ gains_xp: event.target.checked })}
            className={CHECKBOX_CLASS}
          />
          Gains experience
        </label>
      ) : null}
    </div>
  );
}
