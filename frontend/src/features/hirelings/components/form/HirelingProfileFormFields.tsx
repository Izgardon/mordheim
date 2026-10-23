import { FieldError } from "@/components/ui/field-error";
import BestiaryLinksFields from "@/features/bestiary/components/form/BestiaryLinksFields";
import { StatsField } from "@/features/bestiary/components/form/bestiary-core-fields";

import HirelingIdentityFields from "./HirelingIdentityFields";
import HirelingRestrictionsField from "./HirelingRestrictionsField";
import HirelingTermsFields from "./HirelingTermsFields";

import type { HirelingProfileFormState } from "../../hooks/useHirelingProfileForm";

/**
 * A hired sword's or dramatis persona's fields: who he is, the hire terms, the profile, what he
 * knows and carries (kit quantities up to 20), and who may hire him.
 */
export default function HirelingProfileFormFields({
  form,
  open,
}: {
  form: HirelingProfileFormState;
  open: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <HirelingIdentityFields form={form} open={open} />
      <HirelingTermsFields form={form} />
      <div className="flex flex-col gap-1">
        <StatsField values={form.values} onChange={form.change} />
        <FieldError message={form.fieldErrors.armour_save} />
      </div>
      <BestiaryLinksFields links={form.links} />
      <FieldError message={form.fieldErrors.item_entries} />
      <HirelingRestrictionsField restrictions={form.restrictions} />
    </div>
  );
}
