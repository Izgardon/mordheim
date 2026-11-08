import { CheckboxField } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import BestiaryLinksFields from "@/features/bestiary/components/form/BestiaryLinksFields";
import { CASTER_OPTIONS } from "@/features/bestiary/utils/bestiary-form";

import { HIRELING_SKILL_TYPES } from "../../utils/hireling-form";

import type { HirelingProfileFormState } from "../../hooks/useHirelingProfileForm";

/** Whether he casts, and as what, as a row of chips (William: "caster doesn't need to be that big"). */
function CasterChips({ form }: { form: HirelingProfileFormState }) {
  return (
    <div role="group" aria-label="Caster" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm font-medium text-ink">Caster</span>
      {CASTER_OPTIONS.map((option) => (
        <Chip
          key={option}
          pressed={form.values.caster === option}
          className="min-h-8 px-2.5 text-xs"
          onClick={() => form.change({ caster: option })}
        >
          {option}
        </Chip>
      ))}
    </div>
  );
}

/**
 * What he may learn: the skill groups as a grid of the shared tick boxes (William, 7 Nov 2026:
 * "change skill group checkboxes too"), the skills and spells he knows, and the caster.
 */
export default function HirelingSkillsFields({ form }: { form: HirelingProfileFormState }) {
  const { values } = form;
  // The usual groups, and any the entry already learns from (a hired sword's own group).
  const skillTypes = [
    ...HIRELING_SKILL_TYPES,
    ...values.available_skill_types.filter((type) => !HIRELING_SKILL_TYPES.includes(type)),
  ];
  return (
    <>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">Skill groups</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 min-[520px]:grid-cols-3">
          {skillTypes.map((type) => (
            <CheckboxField
              key={type}
              checked={values.available_skill_types.includes(type)}
              onChange={(event) => form.toggleSkillType(type, event.target.checked)}
            >
              {type}
            </CheckboxField>
          ))}
        </div>
      </fieldset>
      <BestiaryLinksFields links={form.links} parts={["skills", "spells"]} />
      <CasterChips form={form} />
    </>
  );
}
