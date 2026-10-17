import UnitIdentityFields from "../../forms/UnitIdentityFields";
import { TraitToggle } from "../../forms/UnitSkillsTraitsPanel";
import UnitXpPriceFields from "../../forms/UnitXpPriceFields";
import { syncLargeSpecial } from "../../forms/trait-specials";

import type { UnitFormSlotProps } from "../../forms/form-types";

/** Group card basics: identity, Large and No level ups (no caster or skill access), XP, base cost. */
export default function HenchmenFormBasics({
  form: group,
  index,
  campaignId,
  availableRaces,
  availableSpecials,
  inputClassName,
  onUpdate,
  onRaceCreated,
  hasFieldError,
}: UnitFormSlotProps<"henchmen_group">) {
  return (
    <>
      <UnitIdentityFields
        form={group}
        index={index}
        campaignId={campaignId}
        availableRaces={availableRaces}
        inputClassName={inputClassName}
        onUpdate={onUpdate}
        onRaceCreated={onRaceCreated}
        hasFieldError={hasFieldError}
        nameLabel="Group name"
        namePlaceholder="Group name"
        typePlaceholder="Warrior, Zombie"
        keepsRaceProfile={false}
      />
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-border/60 bg-background/50 p-3">
        <TraitToggle
          checked={group.large}
          onChange={(checked) =>
            onUpdate(index, (current) => ({
              ...current,
              large: checked,
              specials: syncLargeSpecial(current.specials, checked, availableSpecials),
            }))
          }
          label="Large"
        />
        <TraitToggle
          checked={group.no_level_ups}
          onChange={(checked) =>
            onUpdate(index, (current) => ({ ...current, no_level_ups: checked }))
          }
          label="No level ups"
        />
      </div>
      <UnitXpPriceFields
        variant="henchmen"
        form={group}
        index={index}
        inputClassName={inputClassName}
        onUpdate={onUpdate}
        priceLabel="Base cost"
      />
    </>
  );
}
