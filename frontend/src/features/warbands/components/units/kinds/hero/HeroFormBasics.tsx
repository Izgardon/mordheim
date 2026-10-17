import UnitIdentityFields from "../../forms/UnitIdentityFields";
import UnitSkillsTraitsPanel, { TraitToggle } from "../../forms/UnitSkillsTraitsPanel";
import UnitXpPriceFields from "../../forms/UnitXpPriceFields";

import type { UnitFormSlotProps } from "../../forms/form-types";

/** Hero card basics: identity, skill access and traits (leader, trading action), XP and cost. */
export default function HeroFormBasics({
  form,
  index,
  campaignId,
  availableRaces,
  availableSkills,
  availableSpecials,
  inputClassName,
  onUpdate,
  onSetLeader,
  onRaceCreated,
  hasFieldError,
}: UnitFormSlotProps<"hero">) {
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
              checked={Boolean(form.is_leader)}
              onChange={(checked) => onSetLeader?.(index, checked)}
              label="Leader"
            />
            <TraitToggle
              checked={Boolean(form.trading_action)}
              onChange={(checked) =>
                onUpdate(index, (current) => ({ ...current, trading_action: checked }))
              }
              label="Trading Action"
            />
          </>
        }
      />
      <UnitXpPriceFields
        variant="hero"
        form={form}
        index={index}
        inputClassName={inputClassName}
        onUpdate={onUpdate}
        priceLabel="Recruit cost"
      />
    </>
  );
}
