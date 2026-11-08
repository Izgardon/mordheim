import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { useCampaignResources } from "@/features/campaigns/api/campaign-resources";
import { OptionField } from "@/features/bestiary/components/form/bestiary-core-fields";

import { HIRE_KINDS, UPKEEP_KINDS } from "../../fees";
import FeeEditor from "../fees/FeeEditor";
import { takesHerosPlace } from "../../utils/hireling-form";

import type { HirelingProfileFormState } from "../../hooks/useHirelingProfileForm";
import type { HirelingStays } from "../../types/hireling-catalogue-types";

const STAYS: { value: HirelingStays; label: string }[] = [
  { value: "always", label: "Until dismissed" },
  { value: "one_battle", label: "One battle" },
];

const CAPTION = "text-xs font-bold text-muted-foreground";

/** A dramatis persona's terms: how long he stays, and what he is paid in. */
function PersonaTerms({ form }: { form: HirelingProfileFormState }) {
  const stays = STAYS.find((option) => option.value === form.values.stays) ?? STAYS[0];
  return (
    <div className="flex flex-wrap gap-3">
      <OptionField
        label="Stays"
        value={stays.label}
        options={STAYS.map((option) => option.label)}
        onChange={(label) =>
          form.change({ stays: STAYS.find((option) => option.label === label)?.value })
        }
        className="flex min-w-[140px] flex-1 flex-col gap-1.5"
      />
      <label className={`flex min-w-[160px] flex-[2] flex-col gap-1.5 ${CAPTION}`}>
        Paid in
        <Input
          id="hireling-payment-note"
          value={form.values.payment_note}
          onChange={(event) => form.change({ payment_note: event.target.value })}
          aria-invalid={Boolean(form.fieldErrors.payment_note)}
        />
        <FieldError message={form.fieldErrors.payment_note} />
      </label>
    </div>
  );
}

/**
 * The hire fee and the upkeep (William, 7 Nov 2026): each the gold and dice on one line with at
 * most one of the campaign's resources, and the line it reads as; no upkeep for one who takes a
 * hero's place ("upkeep section should disappear if take a heroes place is selected above and it
 * should never be an option in upkeep"). Then the rating on one compact row ("rating line doesn't
 * need to be that big") and a dramatis persona's terms.
 */
export default function HirelingTermsFields({
  form,
  open,
}: {
  form: HirelingProfileFormState;
  open: boolean;
}) {
  const { values } = form;
  const resources = useCampaignResources(form.campaignId, open).data;
  return (
    <>
      <div className="flex flex-col gap-1">
        <FeeEditor
          label="Hire fee"
          reads="Hire"
          idPrefix="hireling-hire-fee"
          kinds={HIRE_KINDS}
          resources={resources}
          value={values.hire_fee}
          onChange={(hire_fee) => form.change({ hire_fee })}
        />
        <FieldError message={form.fieldErrors.hire_fee} />
      </div>
      {takesHerosPlace(values) ? null : (
        <div className="flex flex-col gap-1">
          <FeeEditor
            label="Upkeep"
            reads="Upkeep"
            idPrefix="hireling-upkeep-fee"
            kinds={UPKEEP_KINDS}
            resources={resources}
            value={values.upkeep_fee}
            onChange={(upkeep_fee) => form.change({ upkeep_fee })}
          />
          <FieldError message={form.fieldErrors.upkeep_fee} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          Rating
          <span className="text-text2">+</span>
          <NumberInput
            compact
            id="hireling-rating"
            inputSize="sm"
            min={0}
            className="w-20 font-mono"
            value={values.rating}
            onChange={(event) => form.change({ rating: event.target.value })}
            aria-invalid={Boolean(form.fieldErrors.rating)}
          />
        </label>
        <FieldError message={form.fieldErrors.rating} />
      </div>
      {form.config.hasPersonaTerms ? <PersonaTerms form={form} /> : null}
    </>
  );
}
