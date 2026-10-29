import { Checkbox } from "@/components/ui/checkbox";
import BattleUnitStatsAndItems from "@/features/battles/components/shared/BattleUnitStatsAndItems";
import { getBattleCardThemeStyle } from "@/features/battles/components/shared/battle-card-theme";
import CreatureMark from "@/features/warbands/components/units/beasts/CreatureMark";
import { PetChips, RiderMark } from "@/features/battles/components/shared/BattleCompanionParts";
import { groupMountedStats } from "@/features/battles/utils/battle-companions";
import PrebattleMissingNote from "./PrebattleMissingNote";

import type {
  HenchmenGroupRoster,
  PrebattleUnit,
  StatKey,
  UnitOverride,
  UnitSingleUseItem,
} from "./prebattle-types";

type PrebattleHenchmenGroupRowProps = {
  group: HenchmenGroupRoster;
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
  canUseItems: boolean;
  onUseSingleUseItem: (unit: PrebattleUnit, item: UnitSingleUseItem) => void;
  getUsedSingleUseItemCount: (unitKey: string, itemId: number) => number;
  activeItemActionKey: string | null;
};

/**
 * A henchmen group in prebattle: its members picked one by one, and one stats panel for the
 * picked members (a stat change or a note applies to all of them).
 */
export default function PrebattleHenchmenGroupRow({
  group,
  editable,
  isUnitSelected,
  getUnitOverride,
  getUnitNotes,
  editingUnitKey,
  onToggleUnitSelection,
  onToggleEditingUnit,
  onUpdateOverrideStat,
  onUpdateUnitNotes,
  onClearUnitOverride,
  canUseItems,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
}: PrebattleHenchmenGroupRowProps) {
  if (group.members.length === 0) {
    return null;
  }

  const selectedMembers = group.members.filter((member) => isUnitSelected(member.key));
  const groupEditKey = selectedMembers[0]?.key ?? group.members[0].key;
  const groupOverrideSource =
    selectedMembers.find((member) => {
      const override = getUnitOverride(member.key);
      return Boolean(override && Object.keys(override.stats).length > 0);
    }) ??
    selectedMembers.find((member) => getUnitNotes(member.key).trim()) ??
    selectedMembers[0] ??
    group.members[0];
  const groupOverride = getUnitOverride(groupOverrideSource.key);
  const groupNotes = getUnitNotes(groupOverrideSource.key);
  const isEditing = editingUnitKey === groupEditKey;
  const selectedCount = selectedMembers.length;

  const applyOverrideStatToGroup = (key: StatKey, value: string) => {
    selectedMembers.forEach((member) => onUpdateOverrideStat(member, key, value));
  };

  const applyNotesToGroup = (notes: string) => {
    selectedMembers.forEach((member) => onUpdateUnitNotes(member.key, notes));
  };

  const clearGroupOverride = () => {
    selectedMembers.forEach((member) => onClearUnitOverride(member.key));
  };
  const groupSingleUseItems = group.members[0].singleUseItems ?? [];

  return (
    <div className="battle-card p-4" style={getBattleCardThemeStyle("henchmen_group")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {group.beastKind === "creature" ? <CreatureMark /> : null}
            {group.name}
          </p>
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
            {group.unitType} {selectedCount}/{group.members.length}
          </p>
          <PrebattleMissingNote unit={group} selected={selectedCount > 0} />
          <PetChips pets={group.members[0].pets} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {group.members.map((member) => (
          <label
            key={`member-toggle-${member.key}`}
            className="battle-chip inline-flex items-center gap-2 rounded-md px-2 py-1"
          >
            <Checkbox
              checked={isUnitSelected(member.key)}
              disabled={!editable}
              onChange={() => onToggleUnitSelection(member.key)}
            />
            <RiderMark mount={member.mount} />
            <span className="text-xs text-foreground">{member.displayName}</span>
          </label>
        ))}
      </div>

      {selectedCount > 0 ? (
        <BattleUnitStatsAndItems
          unitKey={groupEditKey}
          baseStats={group.members[0].stats}
          override={groupOverride}
          mounted={groupMountedStats(selectedMembers, groupOverride?.stats)}
          notes={groupNotes}
          editable={editable}
          isEditing={isEditing}
          onToggleEditing={() => onToggleEditingUnit(groupEditKey)}
          onUpdateStat={applyOverrideStatToGroup}
          onUpdateNotes={applyNotesToGroup}
          onResetOverride={clearGroupOverride}
          singleUseItems={groupSingleUseItems}
          canUseItems={editable && canUseItems}
          onUseItem={(item) => onUseSingleUseItem(group.members[0], item)}
          getUsedItemCount={(itemId) => getUsedSingleUseItemCount(groupEditKey, itemId)}
          activeItemActionKey={activeItemActionKey}
          constrainStatsToHalfWidth
        />
      ) : null}
    </div>
  );
}
