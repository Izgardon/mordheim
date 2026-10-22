import NewHirelingSkillDialog from "@/features/skills/components/NewHirelingSkillDialog";
import NewHirelingSpellDialog from "@/features/spells/components/NewHirelingSpellDialog";
import { calculateUnitTotalPrice } from "../../../../utils/warband-utils";
import { CasterTile, CostTile, SizeTile, StatTile } from "../../expanded/ExpandedTiles";

import type { WarbandHireling } from "../../../../types/warband-types";
import type {
  ExpandedTilesProps,
  PendingAdvanceDialogsProps,
} from "../../../../units/unit-slot-types";

export function HirelingExpandedTitle({ unit: hireling }: { unit: WarbandHireling }) {
  return (
    <h2 className="text-2xl font-bold text-foreground">{hireling.name || "Unnamed Hired Sword"}</h2>
  );
}

/** Size, Caster, Bloodpacted, Total Cost = base + items (upkeep excluded) and Upkeep. */
export function HirelingExpandedTiles({ unit: hireling, layout }: ExpandedTilesProps<"hireling">) {
  const { basePrice, totalPrice } = calculateUnitTotalPrice(hireling);
  return (
    <>
      <SizeTile layout={layout} large={hireling.large} />
      <CasterTile layout={layout} caster={hireling.caster} spells={hireling.spells} />
      {hireling.blood_pacted ? <StatTile layout={layout} label="Bloodpacted" value="Yes" /> : null}
      <CostTile
        layout={layout}
        label="Total Cost"
        total={totalPrice}
        baseCost={basePrice}
        lines={(hireling.items ?? []).map((item) => ({
          key: item.id,
          label: item.name,
          cost: Number(item.cost ?? 0),
        }))}
      />
      <StatTile
        layout={layout}
        label="Upkeep"
        value={Number(hireling.upkeep_price ?? 0) || 0}
        className={layout === "mobile" ? undefined : "self-start"}
      />
    </>
  );
}

export function HirelingPendingDialogs({
  unit: hireling,
  warbandId,
  spellOpen,
  onSpellOpenChange,
  skillOpen,
  onSkillOpenChange,
  onUnitUpdated,
}: PendingAdvanceDialogsProps<"hireling">) {
  return (
    <>
      <NewHirelingSpellDialog
        hireling={hireling}
        warbandId={warbandId}
        open={spellOpen}
        onOpenChange={onSpellOpenChange}
        onHirelingUpdated={onUnitUpdated}
      />
      <NewHirelingSkillDialog
        hireling={hireling}
        warbandId={warbandId}
        open={skillOpen}
        onOpenChange={onSkillOpenChange}
        onHirelingUpdated={onUnitUpdated}
      />
    </>
  );
}
