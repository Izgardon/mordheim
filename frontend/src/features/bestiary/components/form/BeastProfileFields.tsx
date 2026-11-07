import { NumberInput } from "@/components/ui/number-input";
import { CheckboxField } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";

import { StatsField } from "./bestiary-core-fields";

import type { BestiaryEntryFormState } from "../../hooks/useBestiaryEntryForm";

/**
 * The beast's profile and what its kind adds: "Has a profile" (off, the stats hide and are saved
 * empty), a mount's "Rating bonus for the rider", and a creature's "Gains experience".
 */
export default function BeastProfileFields({ form }: { form: BestiaryEntryFormState }) {
  const { values, change, fieldErrors } = form;
  return (
    <div className="flex flex-col gap-3">
      <CheckboxField
        checked={values.has_profile}
        onChange={(event) => change({ has_profile: event.target.checked })}
      >
        Has a profile
      </CheckboxField>
      {values.has_profile ? (
        <div className="flex flex-col gap-1">
          <StatsField values={values} onChange={change} />
          <FieldError message={fieldErrors.armour_save} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No profile: its stats are cleared when you save.
        </p>
      )}

      {values.kind === "mount" ? (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="bestiary-rating-bonus">Rating bonus for the rider</Label>
          <NumberInput
            id="bestiary-rating-bonus"
            min={0}
            step={1}
            value={values.rating_bonus}
            onChange={(event) => change({ rating_bonus: event.target.value })}
            aria-invalid={Boolean(fieldErrors.rating_bonus)}
          />
          <FieldError message={fieldErrors.rating_bonus} />
        </div>
      ) : null}

      {values.kind === "creature" ? (
        <CheckboxField
          checked={values.gains_xp}
          onChange={(event) => change({ gains_xp: event.target.checked })}
        >
          Gains experience
        </CheckboxField>
      ) : null}
    </div>
  );
}
