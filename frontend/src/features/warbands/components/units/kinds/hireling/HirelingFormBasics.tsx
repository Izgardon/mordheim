import UnitIdentityFields from "../../forms/UnitIdentityFields";
import UnitSkillsTraitsPanel, { TraitToggle } from "../../forms/UnitSkillsTraitsPanel";
import UnitXpPriceFields from "../../forms/UnitXpPriceFields";
import HirelingTermsFields from "./HirelingTermsFields";
import { hirelingTermsOf } from "../../../../units/kinds/hireling-terms";

import type { UnitFormSlotProps } from "../../forms/form-types";

/**
 * Hired sword card basics: as heroes, with blood pact, no level-ups, rating and upkeep, and its
 * terms (the kind for a queued recruit; the injury table; a dramatis persona's stay and pay).
 */
export default function HirelingFormBasics({
  form,
  index,
  campaignId,
  availableRaces,
  availableSkills,
  availableSpecials,
  inputClassName,
  onUpdate,
  onRaceCreated,
  hasFieldError,
}: UnitFormSlotProps<"hireling">) {
  return (
    <>
      <UnitIdentityFields
        form={form}
        index={index}
        campaignId={campaignId}
        availableRaces={availableRaces}
        inputClassName={inputClassName}
        onUpdate={onUpdate}
        onRaceCreated={onRaceCreated}
        hasFieldError={hasFieldError}
        nameLabel="Name"
        namePlaceholder="Hero name"
        typePlaceholder="Chieftain, Champion"
        keepsRaceProfile
      />
      <UnitSkillsTraitsPanel
        form={form}
        index={index}
        availableSkills={availableSkills}
        availableSpecials={availableSpecials}
        onUpdate={onUpdate}
        extraTraits={
          <>
            <TraitToggle
              checked={Boolean(form.blood_pacted)}
              onChange={(checked) =>
                onUpdate(index, (current) => ({ ...current, blood_pacted: checked }))
              }
              label="Bloodpacted"
            />
            <TraitToggle
              checked={Boolean(form.no_level_ups)}
              onChange={(checked) =>
                onUpdate(index, (current) => ({ ...current, no_level_ups: checked }))
              }
              label="No level ups"
            />
          </>
        }
      />
      <UnitXpPriceFields
        variant="hireling"
        form={form}
        index={index}
        inputClassName={inputClassName}
        onUpdate={onUpdate}
        priceLabel="Hire price"
      />
      <HirelingTermsFields
        idPrefix={`hireling-${form.id ?? form.draftKey ?? index}`}
        terms={hirelingTermsOf(form)}
        onChange={(patch) => onUpdate(index, (current) => ({ ...current, ...patch }))}
        showKind={!form.id}
        inputClassName={inputClassName}
      />
    </>
  );
}
