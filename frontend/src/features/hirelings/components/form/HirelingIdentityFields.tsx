import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CasterField,
  DescriptionField,
  LargeTargetField,
} from "@/features/bestiary/components/form/bestiary-core-fields";
import { CatalogueNameField } from "@/features/catalogue/components/form-layout";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { HirelingProfileFormState } from "../../hooks/useHirelingProfileForm";

const NO_RACE = "none";

/**
 * The race: one of the campaign's races when it matches, and the label, which always keeps the
 * text (it is what shows when no race matched, "Chameleon Skink"). Picking a race fills the label.
 */
function RaceFields({ form, open }: { form: HirelingProfileFormState; open: boolean }) {
  const { data: races } = useCatalogue("races", form.campaignId, { enabled: open });
  const { values, change } = form;
  const value = values.race_id === null ? NO_RACE : String(values.race_id);
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
        <Label htmlFor="hireling-race">Race</Label>
        <Select
          value={value}
          onValueChange={(next) => {
            const race = races.find((entry) => String(entry.id) === next);
            change(
              race ? { race_id: race.id, race_label: race.name } : { race_id: null, race_label: "" }
            );
          }}
        >
          <SelectTrigger id="hireling-race">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_RACE}>None of these</SelectItem>
            {races.map((race) => (
              <SelectItem key={race.id} value={String(race.id)}>
                {race.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
        <Label htmlFor="hireling-race-label">Race label</Label>
        <Input
          id="hireling-race-label"
          value={values.race_label}
          onChange={(event) => change({ race_label: event.target.value })}
          aria-invalid={Boolean(form.fieldErrors.race_label)}
          placeholder="e.g. Chameleon Skink"
        />
        <FieldError message={form.fieldErrors.race_label} />
      </div>
    </div>
  );
}

/** Name (with a taken name's matches), race, caster, size and description. */
export default function HirelingIdentityFields({
  form,
  open,
}: {
  form: HirelingProfileFormState;
  open: boolean;
}) {
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
      <RaceFields form={form} open={open} />
      <div className="flex flex-wrap items-end gap-3">
        <CasterField values={values} onChange={change} className="flex flex-1 flex-col gap-1.5" />
        <div className="pb-2">
          <LargeTargetField values={values} onChange={change} />
        </div>
      </div>
      <DescriptionField values={values} onChange={change} id="hireling-description" />
    </>
  );
}
