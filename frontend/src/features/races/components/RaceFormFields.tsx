import type { FocusEvent, MouseEvent } from "react";

import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";

import { CatalogueNameField } from "@/features/catalogue/components/form-layout";
import { STAT_FIELDS } from "@/features/catalogue/utils/statblock";

import type { RaceFormState } from "../hooks/useRaceForm";

/** A click or tab into a box selects its value, so a typed stat replaces the 0. */
const selectAll = (event: FocusEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) => {
  event.currentTarget.select();
};

/** A race's name and maximum characteristics (the race picker's dialog). */
export default function RaceFormFields({ form }: { form: RaceFormState }) {
  return (
    <>
      <CatalogueNameField
        layout="dialog"
        id="race-name"
        value={form.values.name}
        onChange={form.setName}
        error={form.fieldErrors.name}
        placeholder="Human"
        onFocus={selectAll}
        onClick={selectAll}
      />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Max Characteristics
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {STAT_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`race-${key}`} className="text-sm font-semibold text-foreground">
                {label}
              </Label>
              <NumberInput
                id={`race-${key}`}
                min={0}
                max={10}
                value={form.values.stats[key]}
                stepButtonsTabIndex={-1}
                onChange={(event) => form.setStat(key, event.target.value)}
                onFocus={selectAll}
                onClick={selectAll}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
