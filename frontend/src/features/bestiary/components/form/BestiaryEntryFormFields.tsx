import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import BeastKindField from "./BeastKindField";
import BestiaryLinksFields from "./BestiaryLinksFields";
import {
  CasterField,
  DescriptionField,
  LargeTargetField,
  StatsField,
} from "./bestiary-core-fields";

import type { BestiaryEntryFormState } from "../../hooks/useBestiaryEntryForm";

/** A bestiary entry's fields: kind and name, caster, description, stats, links, large target. */
export default function BestiaryEntryFormFields({ form }: { form: BestiaryEntryFormState }) {
  const { values, change } = form;
  return (
    <>
      <BeastKindField value={values.kind} onChange={(kind) => change({ kind })} />
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
      </div>

      <CasterField values={values} onChange={change} />
      <DescriptionField values={values} onChange={change} id="bestiary-desc" />
      <StatsField values={values} onChange={change} />
      <BestiaryLinksFields links={form.links} />
      <LargeTargetField values={values} onChange={change} />
    </>
  );
}
