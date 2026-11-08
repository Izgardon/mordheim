import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import BestiaryLinksFields from "@/features/bestiary/components/form/BestiaryLinksFields";
import { TEXTAREA } from "@/features/catalogue/components/form-layout";
import WhoCanField from "@/features/catalogue/components/WhoCanField";

import FormSection from "./FormSection";
import { HirelingProfileFields, HirelingWhoFields } from "./HirelingIdentityFields";
import HirelingSkillsFields from "./HirelingSkillsFields";
import HirelingTermsFields from "./HirelingTermsFields";

import type { HirelingProfileFormState } from "../../hooks/useHirelingProfileForm";

/**
 * A hired sword's or dramatis persona's fields in their parts (William, 7 Nov 2026: "improve
 * general layout and grouping"): who he is, his profile, the hire fee and upkeep, what he may
 * learn and cast, his rules, his wargear (kit quantities up to 20), who may hire him, and the
 * book's description last.
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
      <FormSection title="Who">
        <HirelingWhoFields form={form} />
      </FormSection>
      <FormSection title="Profile">
        <HirelingProfileFields form={form} />
      </FormSection>
      <FormSection title="Hire fee and upkeep">
        <HirelingTermsFields form={form} open={open} />
      </FormSection>
      <FormSection title="Skills and caster">
        <HirelingSkillsFields form={form} />
      </FormSection>
      <FormSection title="Rules">
        <BestiaryLinksFields links={form.links} parts={["rules"]} />
      </FormSection>
      <FormSection title="Wargear">
        <BestiaryLinksFields links={form.links} parts={["equipment"]} />
        <FieldError message={form.fieldErrors.item_entries} />
      </FormSection>
      <FormSection title="Who can hire">
        <WhoCanField
          campaignId={form.campaignId}
          id="hireling-who"
          label="Warbands"
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
      </FormSection>
      <FormSection title="Description">
        <textarea
          id="hireling-description"
          aria-label="Description"
          value={form.values.description}
          onChange={(event) => form.change({ description: event.target.value })}
          className={TEXTAREA}
        />
      </FormSection>
    </div>
  );
}
