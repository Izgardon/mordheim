import NewHiredSwordSkillDialog from "@/features/skills/components/NewHiredSwordSkillDialog";
import NewHiredSwordSpellDialog from "@/features/spells/components/NewHiredSwordSpellDialog";
import { calculateUnitTotalPrice } from "../../../../utils/warband-utils";
import { CasterTile, CostTile, SizeTile, StatTile } from "../../expanded/ExpandedTiles";

import type { WarbandHiredSword } from "../../../../types/warband-types";
import type {
  ExpandedTilesProps,
  PendingAdvanceDialogsProps,
} from "../../../../units/unit-slot-types";

export function HiredSwordExpandedTitle({ unit: hiredSword }: { unit: WarbandHiredSword }) {
  return (
    <h2 className="text-2xl font-bold text-foreground">
      {hiredSword.name || "Unnamed Hired Sword"}
    </h2>
  );
}

/** Size, Caster, Bloodpacted, Total Cost = base + items (upkeep excluded) and Upkeep. */
export function HiredSwordExpandedTiles({
  unit: hiredSword,
  layout,
}: ExpandedTilesProps<"hired_sword">) {
  const { basePrice, totalPrice } = calculateUnitTotalPrice(hiredSword);
  return (
    <>
      <SizeTile layout={layout} large={hiredSword.large} />
      <CasterTile layout={layout} caster={hiredSword.caster} spells={hiredSword.spells} />
      {hiredSword.blood_pacted ? (
        <StatTile layout={layout} label="Bloodpacted" value="Yes" />
      ) : null}
      <CostTile
        layout={layout}
        label="Total Cost"
        total={totalPrice}
        baseCost={basePrice}
        lines={(hiredSword.items ?? []).map((item) => ({
          key: item.id,
          label: item.name,
          cost: Number(item.cost ?? 0),
        }))}
      />
      <StatTile
        layout={layout}
        label="Upkeep"
        value={Number(hiredSword.upkeep_price ?? 0) || 0}
        className={layout === "mobile" ? undefined : "self-start"}
      />
    </>
  );
}

export function HiredSwordPendingDialogs({
  unit: hiredSword,
  warbandId,
  spellOpen,
  onSpellOpenChange,
  skillOpen,
  onSkillOpenChange,
  onUnitUpdated,
}: PendingAdvanceDialogsProps<"hired_sword">) {
  return (
    <>
      <NewHiredSwordSpellDialog
        hiredSword={hiredSword}
        warbandId={warbandId}
        open={spellOpen}
        onOpenChange={onSpellOpenChange}
        onHiredSwordUpdated={onUnitUpdated}
      />
      <NewHiredSwordSkillDialog
        hiredSword={hiredSword}
        warbandId={warbandId}
        open={skillOpen}
        onOpenChange={onSkillOpenChange}
        onHiredSwordUpdated={onUnitUpdated}
      />
    </>
  );
}
