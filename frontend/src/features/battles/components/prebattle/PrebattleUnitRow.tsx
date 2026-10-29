import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import BattleUnitStatsAndItems from "@/features/battles/components/shared/BattleUnitStatsAndItems";
import { getBattleCardThemeStyle } from "@/features/battles/components/shared/battle-card-theme";
import { PetChips, RiderMark } from "@/features/battles/components/shared/BattleCompanionParts";
import { mountedStats } from "@/features/battles/utils/battle-companions";
import PrebattleMissingNote from "./PrebattleMissingNote";

import type { PrebattleUnit, StatKey, UnitOverride, UnitSingleUseItem } from "./prebattle-types";

/** What every prebattle unit row reads and does, from the participant's roster. */
export type PrebattleRowTools = {
  editable: boolean;
  isUnitSelected: (unitKey: string) => boolean;
  getUnitOverride: (unitKey: string) => UnitOverride | undefined;
  getUnitNotes: (unitKey: string) => string;
  editingUnitKey: string | null;
  onToggleUnitSelection: (unitKey: string) => void;
  onToggleEditingUnit: (unitKey: string) => void;
  onUpdateOverrideStat: (unit: PrebattleUnit, key: StatKey, value: string) => void;
  onUpdateUnitNotes: (unitKey: string, notes: string) => void;
  onClearUnitOverride: (unitKey: string) => void;
  onRemoveCustomUnit: (unitKey: string) => void;
  canUseItems: boolean;
  onUseSingleUseItem: (unit: PrebattleUnit, item: UnitSingleUseItem) => void;
  getUsedSingleUseItemCount: (unitKey: string, itemId: number) => number;
  activeItemActionKey: string | null;
};

/** A hero, hired sword or temporary unit in prebattle: picked or not, with its stats panel. */
export default function PrebattleUnitRow({
  unit,
  tools,
}: {
  unit: PrebattleUnit;
  tools: PrebattleRowTools;
}) {
  const { editable } = tools;
  const selected = tools.isUnitSelected(unit.key);
  const override = tools.getUnitOverride(unit.key);

  return (
    <div className="battle-card p-4" style={getBattleCardThemeStyle(unit.kind)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected}
            disabled={!editable}
            onChange={() => tools.onToggleUnitSelection(unit.key)}
          />
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <RiderMark mount={unit.mount} />
              {unit.displayName}
            </p>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              {unit.unitType}
            </p>
            <PrebattleMissingNote unit={unit} selected={selected} />
            <PetChips pets={unit.pets} />
            {unit.kind === "custom" ? (
              <p className="mt-1 text-xs text-muted-foreground">Rating: {unit.rating ?? 0}</p>
            ) : null}
          </div>
        </div>
        {editable && unit.kind === "custom" ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => tools.onRemoveCustomUnit(unit.key)}
          >
            Remove
          </Button>
        ) : null}
      </div>

      {selected ? (
        <BattleUnitStatsAndItems
          unitKey={unit.key}
          baseStats={unit.stats}
          override={override}
          mounted={mountedStats(unit, override?.stats)}
          notes={tools.getUnitNotes(unit.key)}
          editable={editable}
          isEditing={tools.editingUnitKey === unit.key}
          onToggleEditing={() => tools.onToggleEditingUnit(unit.key)}
          onUpdateStat={(key, value) => tools.onUpdateOverrideStat(unit, key, value)}
          onUpdateNotes={(notes) => tools.onUpdateUnitNotes(unit.key, notes)}
          onResetOverride={() => tools.onClearUnitOverride(unit.key)}
          singleUseItems={unit.singleUseItems ?? []}
          canUseItems={editable && tools.canUseItems}
          onUseItem={(item) => tools.onUseSingleUseItem(unit, item)}
          getUsedItemCount={(itemId) => tools.getUsedSingleUseItemCount(unit.key, itemId)}
          activeItemActionKey={tools.activeItemActionKey}
          constrainStatsToHalfWidth
        />
      ) : null}
    </div>
  );
}
