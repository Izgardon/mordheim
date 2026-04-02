import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import type { BattleParticipant } from "@/features/battles/types/battle-types";
import BattleUnitStatsAndItems from "@/features/battles/components/shared/BattleUnitStatsAndItems";
import { getBattleCardThemeStyle } from "@/features/battles/components/shared/battle-card-theme";

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
  participantStatusLabel?: string;
  editable: boolean;
  ratingInputValue: string;
  onRatingInputChange: (value: string) => void;
  participantRoster?: ParticipantRoster;
  rosterLoading: boolean;
  rosterError?: string;
  participantSelectedKeys: string[];
  participantOverrides: Record<string, UnitOverride>;
  participantNotes: Record<string, string>;
  participantCustomUnits: PrebattleUnit[];
  selectedUnitKeys: string[];
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
  participantNotes,
  participantCustomUnits,
  selectedUnitKeys,
  editingUnitKey,
  onToggleUnitSelection,
  onToggleEditingUnit,
  onUpdateOverrideStat,
  onUpdateUnitNotes,
  onClearUnitOverride,
  onRemoveCustomUnit,
  canUseItems,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
  sectionIds,
}: PrebattleParticipantRosterProps) {
  const showAllAsSelectedForReadOnly = !editable && participantSelectedKeys.length === 0;
  const ratingDisplayValue = ratingInputValue.trim() === "" ? "-" : ratingInputValue;

  const isUnitSelected = (unitKey: string) =>
    editable
      ? selectedUnitKeys.includes(unitKey)
      : showAllAsSelectedForReadOnly || participantSelectedKeys.includes(unitKey);

  const getUnitOverride = (unitKey: string) =>
    participantOverrides[unitKey];

  const getUnitNotes = (unitKey: string) => participantNotes[unitKey] ?? "";

  const renderUnitRow = (unit: PrebattleUnit) => {
    const selected = isUnitSelected(unit.key);
    const override = getUnitOverride(unit.key);
    const isEditing = editingUnitKey === unit.key;

    return (
      <div
        key={unit.key}
        className="battle-card p-4"
        style={getBattleCardThemeStyle(unit.kind)}
      >
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
            notes={getUnitNotes(unit.key)}
            editable={editable}
            isEditing={isEditing}
            onToggleEditing={() => onToggleEditingUnit(unit.key)}
            onUpdateStat={(key, value) => onUpdateOverrideStat(unit, key, value)}
            onUpdateNotes={(notes) => onUpdateUnitNotes(unit.key, notes)}
            onResetOverride={() => onClearUnitOverride(unit.key)}
            singleUseItems={unit.singleUseItems ?? []}
            canUseItems={editable && canUseItems}
            onUseItem={(item) => onUseSingleUseItem(unit, item)}
            getUsedItemCount={(itemId) => getUsedSingleUseItemCount(unit.key, itemId)}
            activeItemActionKey={activeItemActionKey}
            constrainStatsToHalfWidth
          />
        ) : null}
      </div>
    );
  };

  const renderHenchmenGroupRow = (group: HenchmenGroupRoster) => {
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
      <div
        key={group.id}
        className="battle-card p-4"
        style={getBattleCardThemeStyle("henchmen_group")}
      >
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
              className="battle-chip inline-flex items-center gap-2 rounded-md px-2 py-1"
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
              containerClassName="rounded-md border border-[#4a3828] bg-[#090705]"
              buttonClassName="border-[#4a3828] bg-[#110d09] hover:bg-[#18120d]"
              className="h-9 w-20 border-none bg-transparent text-right"
            />
          ) : (
            <div className="battle-metric-box flex h-9 min-w-[5rem] items-center justify-center rounded-md px-2 text-sm font-semibold text-foreground">
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
