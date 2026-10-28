import { FieldError } from "@/components/ui/field-error";
import { CatalogueNameField } from "@/features/catalogue/components/form-layout";

import BeastKindField from "./BeastKindField";
import BeastProfileFields from "./BeastProfileFields";
import BestiaryLinksFields from "./BestiaryLinksFields";
import ShopFields from "./ShopFields";
import { CasterField, DescriptionField, LargeTargetField } from "./bestiary-core-fields";

import type { BestiaryEntryFormState } from "../../hooks/useBestiaryEntryForm";

/**
 * A beast's fields (the plan's mock): its kind and name (with a taken name's matches), the profile
 * and what its kind adds, caster and size, fluff, what it knows and carries, and the shop.
 */
export default function BestiaryEntryFormFields({ form }: { form: BestiaryEntryFormState }) {
  const { values, change } = form;
  return (
    <div className="flex flex-col gap-4">
      <BeastKindField value={values.kind} onChange={(kind) => change({ kind })} />
      <FieldError message={form.fieldErrors.kind} />
      <CatalogueNameField
        layout="dialog"
        id="bestiary-name"
        value={values.name}
        onChange={(name) => change({ name })}
        error={form.fieldErrors.name}
        nameTaken={form.nameTaken}
        placeholder="e.g. War Hound"
        required
      />
      <BeastProfileFields form={form} />
      <div className="flex flex-wrap items-end gap-3">
        <CasterField values={values} onChange={change} className="flex flex-1 flex-col gap-1.5" />
        <div className="pb-2">
          <LargeTargetField values={values} onChange={change} />
        </div>
      </div>
      <DescriptionField values={values} onChange={change} id="bestiary-desc" />
      <BestiaryLinksFields links={form.links} />
      <FieldError message={form.fieldErrors.item_entries} />
      <ShopFields form={form} />
    </div>
  );
}
