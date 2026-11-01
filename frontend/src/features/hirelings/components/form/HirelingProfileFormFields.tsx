import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import BestiaryLinksFields from "@/features/bestiary/components/form/BestiaryLinksFields";
import { StatsField } from "@/features/bestiary/components/form/bestiary-core-fields";
import WhoCanField from "@/features/catalogue/components/WhoCanField";

import HirelingIdentityFields from "./HirelingIdentityFields";
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
      <WhoCanField
        campaignId={form.campaignId}
        id="hireling-who"
        label="Who can hire"
        value={form.values.who}
        onChange={(who) => form.change({ who })}
      />
      <FieldError message={form.fieldErrors.warbands} />
      <label
        className="flex flex-col gap-1 text-xs font-bold text-muted-foreground"
        htmlFor="hireling-note"
      >
        The book's words on who hires him
        <Input
          id="hireling-note"
          value={form.values.hire_note}
          onChange={(event) => form.change({ hire_note: event.target.value })}
        />
      </label>
    </div>
  );
}
