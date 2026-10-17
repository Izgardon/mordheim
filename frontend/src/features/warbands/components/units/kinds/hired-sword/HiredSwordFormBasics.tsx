import UnitIdentityFields from "../../forms/UnitIdentityFields";
import UnitSkillsTraitsPanel, { TraitToggle } from "../../forms/UnitSkillsTraitsPanel";
import UnitXpPriceFields from "../../forms/UnitXpPriceFields";

import type { UnitFormSlotProps } from "../../forms/form-types";

/** Hired-sword card basics: as heroes, with blood pact, no level-ups, rating and upkeep. */
export default function HiredSwordFormBasics({
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
}: UnitFormSlotProps<"hired_sword">) {
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
        variant="hired_sword"
        form={form}
        index={index}
        inputClassName={inputClassName}
        onUpdate={onUpdate}
        priceLabel="Hire price"
      />
    </>
  );
}
