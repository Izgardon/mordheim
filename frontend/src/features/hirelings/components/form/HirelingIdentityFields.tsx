import { CheckboxField } from "@/components/ui/checkbox";
import { StatsField } from "@/features/bestiary/components/form/bestiary-core-fields";
import { CatalogueNameField } from "@/features/catalogue/components/form-layout";
import RaceField from "@/features/races/components/RaceField";
import { FieldError } from "@/components/ui/field-error";

import type { HirelingProfileFormState } from "../../hooks/useHirelingProfileForm";

/**
 * Who he is: his name (with a taken name's matches) and his race, the shared race field with Add
 * new (William, 7 Nov 2026: "race should be a dropdown with a Add new button"). Picking a race
 * sets the label the entry keeps; a book entry whose race matched none keeps its text until one
 * is picked.
 */
export function HirelingWhoFields({ form }: { form: HirelingProfileFormState }) {
  const { values, change } = form;
  return (
    <>
      <CatalogueNameField
        layout="dialog"
        id="hireling-name"
        value={values.name}
        onChange={(name) => change({ name })}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder={form.config.labels.namePlaceholder}
        required
      />
      <RaceField
        campaignId={form.campaignId}
        value={values.race_id}
        canCreate
        unmatched={values.race_id === null ? values.race_label : ""}
        captionClassName="text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-faint"
        className="gap-2"
        onChange={(race_id, race) => change({ race_id, race_label: race?.name ?? "" })}
      />
      <FieldError message={form.fieldErrors.race_label} />
    </>
  );
}

/** His profile: the nine characteristics and the save, and whether he is a large target. */
export function HirelingProfileFields({ form }: { form: HirelingProfileFormState }) {
  const { values, change } = form;
  return (
    <>
      <div className="flex flex-col gap-1">
        <StatsField values={values} onChange={change} />
        <FieldError message={form.fieldErrors.armour_save} />
      </div>
      <CheckboxField checked={values.large} onChange={(e) => change({ large: e.target.checked })}>
        Large target
      </CheckboxField>
    </>
  );
}
