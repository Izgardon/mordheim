import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import type { BattleParticipant } from "@/features/battles/types/battle-types";
import BattleUnitStatsAndItems from "@/features/battles/components/shared/BattleUnitStatsAndItems";

import type {
  HenchmenGroupRoster,
  ParticipantRoster,
  PrebattleUnit,
  UnitSingleUseItem,
  StatKey,
  UnitOverride,
} from "./prebattle-types";

type PrebattleParticipantRosterProps = {
  participant: BattleParticipant;
  editable: boolean;
  ratingInputValue: string;
  onRatingInputChange: (value: string) => void;
  participantRoster?: ParticipantRoster;
  rosterLoading: boolean;
  rosterError?: string;
  participantSelectedKeys: string[];
  participantOverrides: Record<string, UnitOverride>;
  participantCustomUnits: PrebattleUnit[];
  selectedUnitKeys: string[];
  ownOverrides: Record<string, UnitOverride>;
  editingUnitKey: string | null;
  onToggleUnitSelection: (unitKey: string) => void;
  onToggleEditingUnit: (unitKey: string) => void;
  onUpdateOverrideStat: (unit: PrebattleUnit, key: StatKey, value: string) => void;
  onUpdateOverrideReason: (unitKey: string, reason: string) => void;
  onClearUnitOverride: (unitKey: string) => void;
  onRemoveCustomUnit: (unitKey: string) => void;
  canUseItems: boolean;
  onUseSingleUseItem: (unit: PrebattleUnit, item: UnitSingleUseItem) => void;
  getUsedSingleUseItemCount: (unitKey: string, itemId: number) => number;
  activeItemActionKey: string | null;
  onApplyStatChanges: () => void;
  isApplyingStatChanges: boolean;
  sectionIds?: Partial<Record<"heroes" | "henchmen" | "hired_swords" | "temporary", string>>;
};

export default function PrebattleParticipantRoster({
  participant,
  editable,
  ratingInputValue,
  onRatingInputChange,
  participantRoster,
  rosterLoading,
  rosterError,
  participantSelectedKeys,
  participantOverrides,
  participantCustomUnits,
  selectedUnitKeys,
  ownOverrides,
  editingUnitKey,
  onToggleUnitSelection,
  onToggleEditingUnit,
  onUpdateOverrideStat,
  onUpdateOverrideReason,
  onClearUnitOverride,
  onRemoveCustomUnit,
  canUseItems,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
  onApplyStatChanges,
  isApplyingStatChanges,
  sectionIds,
}: PrebattleParticipantRosterProps) {
  const showAllAsSelectedForReadOnly = !editable && participantSelectedKeys.length === 0;
  const ratingDisplayValue = ratingInputValue.trim() === "" ? "-" : ratingInputValue;

  const isUnitSelected = (unitKey: string) =>
    editable
      ? selectedUnitKeys.includes(unitKey)
      : showAllAsSelectedForReadOnly || participantSelectedKeys.includes(unitKey);

  const getUnitOverride = (unitKey: string) =>
    editable ? ownOverrides[unitKey] : participantOverrides[unitKey];

  const renderUnitRow = (unit: PrebattleUnit) => {
    const selected = isUnitSelected(unit.key);
    const override = getUnitOverride(unit.key);
    const isEditing = editingUnitKey === unit.key;

    return (
      <div key={unit.key} className="rounded-lg border border-[#6e5a3b]/45 bg-black/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selected}
              disabled={!editable}
              onChange={() => onToggleUnitSelection(unit.key)}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">{unit.displayName}</p>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                {unit.unitType}
              </p>
              {unit.kind === "custom" && unit.customReason ? (
                <p className="mt-1 text-xs text-muted-foreground">Reason: {unit.customReason}</p>
              ) : null}
              {unit.kind === "custom" ? (
                <p className="mt-1 text-xs text-muted-foreground">Rating: {unit.rating ?? 0}</p>
              ) : null}
            </div>
          </div>
          {editable && unit.kind === "custom" ? (
            <Button variant="destructive" size="sm" onClick={() => onRemoveCustomUnit(unit.key)}>
              Remove
            </Button>
          ) : null}
        </div>

        {selected ? (
          <BattleUnitStatsAndItems
            unitKey={unit.key}
            baseStats={unit.stats}
            override={override}
            editable={editable}
            isEditing={isEditing}
            onToggleEditing={() => onToggleEditingUnit(unit.key)}
            onUpdateStat={(key, value) => onUpdateOverrideStat(unit, key, value)}
            onUpdateReason={(reason) => onUpdateOverrideReason(unit.key, reason)}
            onResetOverride={() => onClearUnitOverride(unit.key)}
            onApplyStatChanges={onApplyStatChanges}
            isApplyingStatChanges={isApplyingStatChanges}
            singleUseItems={unit.singleUseItems ?? []}
            canUseItems={editable && canUseItems}
            onUseItem={(item) => onUseSingleUseItem(unit, item)}
            getUsedItemCount={(itemId) => getUsedSingleUseItemCount(unit.key, itemId)}
            activeItemActionKey={activeItemActionKey}
          />
        ) : null}
      </div>
    );
  };

  const renderHenchmenGroupRow = (group: HenchmenGroupRoster) => {
    if (group.members.length === 0) {
      return null;
    }

    const groupEditKey = group.members[0].key;
    const groupOverrideSource =
      group.members.find((member) => {
        const override = getUnitOverride(member.key);
        return Boolean(override && (Object.keys(override.stats).length > 0 || override.reason.trim()));
      }) ?? group.members[0];
    const groupOverride = getUnitOverride(groupOverrideSource.key);
    const isEditing = editingUnitKey === groupEditKey;
    const selectedCount = group.members.filter((member) => isUnitSelected(member.key)).length;

    const applyOverrideStatToGroup = (key: StatKey, value: string) => {
      group.members.forEach((member) => onUpdateOverrideStat(member, key, value));
    };

    const applyOverrideReasonToGroup = (reason: string) => {
      group.members.forEach((member) => onUpdateOverrideReason(member.key, reason));
    };

    const clearGroupOverride = () => {
      group.members.forEach((member) => onClearUnitOverride(member.key));
    };
    const groupSingleUseItems = group.members[0].singleUseItems ?? [];

    return (
      <div key={group.id} className="rounded-lg border border-[#6e5a3b]/45 bg-black/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{group.name}</p>
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
              {group.unitType} {selectedCount}/{group.members.length}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {group.members.map((member) => (
            <label
              key={`member-toggle-${member.key}`}
              className="inline-flex items-center gap-2 rounded-md border border-border/40 bg-black/25 px-2 py-1"
            >
              <Checkbox
                checked={isUnitSelected(member.key)}
                disabled={!editable}
                onChange={() => onToggleUnitSelection(member.key)}
              />
              <span className="text-xs text-foreground">{member.displayName}</span>
            </label>
          ))}
        </div>

        {selectedCount > 0 ? (
          <BattleUnitStatsAndItems
            unitKey={groupEditKey}
            baseStats={group.members[0].stats}
            override={groupOverride}
            editable={editable}
            isEditing={isEditing}
            onToggleEditing={() => onToggleEditingUnit(groupEditKey)}
            onUpdateStat={applyOverrideStatToGroup}
            onUpdateReason={applyOverrideReasonToGroup}
            onResetOverride={clearGroupOverride}
            onApplyStatChanges={onApplyStatChanges}
            isApplyingStatChanges={isApplyingStatChanges}
            singleUseItems={groupSingleUseItems}
            canUseItems={editable && canUseItems}
            onUseItem={(item) => onUseSingleUseItem(group.members[0], item)}
            getUsedItemCount={(itemId) => getUsedSingleUseItemCount(groupEditKey, itemId)}
            activeItemActionKey={activeItemActionKey}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div key={participant.id} className="space-y-3">
      <div className="flex items-stretch justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{participant.user.label}</p>
          <p className="text-xs text-muted-foreground">{participant.warband.name}</p>
        </div>
        <div className="flex min-w-[9.5rem] items-center justify-end gap-2">
          <p className="text-xs text-muted-foreground">Rating:</p>
          {editable ? (
            <NumberInput
              value={ratingInputValue}
              allowEmpty
              min={0}
              step={1}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => onRatingInputChange(event.currentTarget.value)}
              className="h-9 w-20 text-right"
            />
          ) : (
            <div className="flex h-9 min-w-[5rem] items-center justify-center rounded-md border border-border/40 bg-black/30 px-2 text-sm font-semibold text-foreground">
              {ratingDisplayValue}
            </div>
          )}
        </div>
      </div>

      {rosterLoading ? (
        <p className="text-sm text-muted-foreground">Loading roster...</p>
      ) : rosterError ? (
        <p className="text-sm text-red-600">{rosterError}</p>
      ) : !participantRoster ? (
        <p className="text-sm text-muted-foreground">No roster found.</p>
      ) : (
        <div className="space-y-4">
          {participantRoster.heroes.length ? (
            <section id={sectionIds?.heroes} className="space-y-2 scroll-mt-28">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Heroes
              </p>
              <div className="space-y-2">{participantRoster.heroes.map((unit) => renderUnitRow(unit))}</div>
            </section>
          ) : null}

          {participantRoster.henchmenGroups.length ? (
            <section id={sectionIds?.henchmen} className="space-y-2 scroll-mt-28">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Henchmen Groups
              </p>
              <div className="space-y-3">{participantRoster.henchmenGroups.map((group) => renderHenchmenGroupRow(group))}</div>
            </section>
          ) : null}

          {participantRoster.hiredSwords.length ? (
            <section id={sectionIds?.hired_swords} className="space-y-2 scroll-mt-28">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Hired Swords
              </p>
              <div className="space-y-2">{participantRoster.hiredSwords.map((unit) => renderUnitRow(unit))}</div>
            </section>
          ) : null}

          {participantCustomUnits.length ? (
            <section id={sectionIds?.temporary} className="space-y-2 scroll-mt-28">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Temporary Units
              </p>
              <div className="space-y-2">{participantCustomUnits.map((unit) => renderUnitRow(unit))}</div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
