import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { BESTIARY_TYPES } from "../../utils/bestiary-form";
import BestiaryLinksFields from "./BestiaryLinksFields";
import {
  CasterField,
  DescriptionField,
  LargeTargetField,
  OptionField,
  StatsField,
} from "./bestiary-core-fields";

import type { BestiaryEntryFormState } from "../../hooks/useBestiaryEntryForm";

/** A bestiary entry's fields: name and type, caster, description, stats, links, large target. */
export default function BestiaryEntryFormFields({ form }: { form: BestiaryEntryFormState }) {
  const { values, change } = form;
  return (
    <>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="bestiary-name">Name</Label>
          <Input
            id="bestiary-name"
            value={values.name}
            onChange={(e) => change({ name: e.target.value })}
            aria-invalid={Boolean(form.fieldErrors.name)}
            placeholder="e.g. War Hound"
            required
          />
          <FieldError message={form.fieldErrors.name} />
        </div>

        <OptionField
          label="Type"
          value={values.type}
          options={BESTIARY_TYPES}
          onChange={(type) => change({ type })}
          className="flex flex-1 flex-col gap-1.5"
        />
      </div>

      <CasterField values={values} onChange={change} />
      <DescriptionField values={values} onChange={change} id="bestiary-desc" />
      <StatsField values={values} onChange={change} />
      <BestiaryLinksFields links={form.links} />
      <LargeTargetField values={values} onChange={change} />
    </>
  );
}
