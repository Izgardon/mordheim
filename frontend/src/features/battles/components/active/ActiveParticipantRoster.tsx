import type { BattleParticipant, BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type {
  HenchmenGroupRoster,
  ParticipantRoster,
  PrebattleUnit,
  UnitOverride,
  UnitSingleUseItem,
} from "@/features/battles/components/prebattle/prebattle-types";

import ActiveUnitCard from "./ActiveUnitCard";
import ActiveHenchmenGroupCard from "./ActiveHenchmenGroupCard";
import type { ActiveBattleUnitOption } from "./active-utils";
import { getParticipantSelectedUnits } from "./active-utils";

type ActiveParticipantRosterProps = {
  participant: BattleParticipant;
  participantRoster?: ParticipantRoster;
  rosterLoading: boolean;
  rosterError?: string;
  unitInformationByKey: Record<string, BattleUnitInformationEntry>;
  killTargetOptions: ActiveBattleUnitOption[];
  canInteract: boolean;
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onAdjustWounds: (unit: PrebattleUnit, delta: number) => Promise<void>;
  onSaveOverride: (unitKey: string, override: UnitOverride | undefined) => Promise<void>;
  onSaveUnitNotes: (unitKey: string, notes: string) => Promise<void>;
  onRecordKill: (payload: {
    killerUnitKey: string;
    victimUnitKey?: string;
    victimName?: string;
    notes?: string;
    earnedXp: boolean;
  }) => Promise<void>;
  onUseSingleUseItem: (unit: PrebattleUnit, item: UnitSingleUseItem) => Promise<void>;
  getUsedSingleUseItemCount: (unitKey: string, itemId: number) => number;
  activeItemActionKey: string | null;
  savingUnitKeys?: Record<string, boolean>;
  sectionIds?: Partial<Record<"heroes" | "henchmen" | "hired_swords" | "temporary", string>>;
};

const SECTION_TITLE_CLASS = "battle-section-title";

export default function ActiveParticipantRoster({
  participant,
  participantRoster,
  rosterLoading,
  rosterError,
  unitInformationByKey,
  killTargetOptions,
  canInteract,
  onSetOutOfAction,
  onAdjustWounds,
  onSaveOverride,
  onSaveUnitNotes,
  onRecordKill,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
  savingUnitKeys = {},
  sectionIds,
}: ActiveParticipantRosterProps) {
  const selectedUnits = getParticipantSelectedUnits(participant, participantRoster);
  const selectedUnitKeySet = new Set(participant.selected_unit_keys_json ?? []);
  const selectedHenchmenGroups: HenchmenGroupRoster[] = (participantRoster?.henchmenGroups ?? [])
    .map((group) => ({
      ...group,
      members: group.members.filter((member) => selectedUnitKeySet.has(member.key)),
    }))
    .filter((group) => group.members.length > 0);

  return (
    <div className="space-y-4">
      {rosterLoading ? (
        <p className="text-sm text-muted-foreground">Loading roster...</p>
      ) : rosterError ? (
        <p className="text-sm text-red-600">{rosterError}</p>
      ) : (
        <div className="space-y-4">
          {selectedUnits.heroes.length ? (
            <section id={sectionIds?.heroes} className="space-y-2 scroll-mt-28">
              <p className={SECTION_TITLE_CLASS}>Heroes</p>
              <div className="space-y-2">
                {selectedUnits.heroes.map((unit) => (
                  <ActiveUnitCard
                    key={unit.key}
                    unit={unit}
                    unitInformation={unitInformationByKey[unit.key]}
                    canInteract={canInteract}
                    killTargetOptions={killTargetOptions}
                    onSetOutOfAction={onSetOutOfAction}
                    onAdjustWounds={onAdjustWounds}
                    onSaveOverride={onSaveOverride}
                    onSaveUnitNotes={onSaveUnitNotes}
                    onRecordKill={onRecordKill}
                    onUseSingleUseItem={onUseSingleUseItem}
                    getUsedSingleUseItemCount={getUsedSingleUseItemCount}
                    activeItemActionKey={activeItemActionKey}
                    isSavingUnitConfig={Boolean(savingUnitKeys[unit.key])}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {selectedHenchmenGroups.length ? (
            <section id={sectionIds?.henchmen} className="space-y-2 scroll-mt-28">
              <p className={SECTION_TITLE_CLASS}>Henchmen</p>
              <div className="space-y-2">
                {selectedHenchmenGroups.map((group) => (
                  <ActiveHenchmenGroupCard
                    key={group.id}
                    groupName={group.name}
                    groupType={group.unitType}
                    members={group.members}
                    canInteract={canInteract}
                    unitInformationByKey={unitInformationByKey}
                    killTargetOptions={killTargetOptions}
                    onSetOutOfAction={onSetOutOfAction}
                    onAdjustWounds={onAdjustWounds}
                    onSaveOverride={onSaveOverride}
                    onSaveUnitNotes={onSaveUnitNotes}
                    onRecordKill={onRecordKill}
                    onUseSingleUseItem={onUseSingleUseItem}
                    getUsedSingleUseItemCount={getUsedSingleUseItemCount}
                    activeItemActionKey={activeItemActionKey}
                    savingUnitKeys={savingUnitKeys}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {selectedUnits.hiredSwords.length ? (
            <section id={sectionIds?.hired_swords} className="space-y-2 scroll-mt-28">
              <p className={SECTION_TITLE_CLASS}>Hired Swords</p>
              <div className="space-y-2">
                {selectedUnits.hiredSwords.map((unit) => (
                  <ActiveUnitCard
                    key={unit.key}
                    unit={unit}
                    unitInformation={unitInformationByKey[unit.key]}
                    canInteract={canInteract}
                    killTargetOptions={killTargetOptions}
                    onSetOutOfAction={onSetOutOfAction}
                    onAdjustWounds={onAdjustWounds}
                    onSaveOverride={onSaveOverride}
                    onSaveUnitNotes={onSaveUnitNotes}
                    onRecordKill={onRecordKill}
                    onUseSingleUseItem={onUseSingleUseItem}
                    getUsedSingleUseItemCount={getUsedSingleUseItemCount}
                    activeItemActionKey={activeItemActionKey}
                    isSavingUnitConfig={Boolean(savingUnitKeys[unit.key])}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {selectedUnits.temporary.length ? (
            <section id={sectionIds?.temporary} className="space-y-2 scroll-mt-28">
              <p className={SECTION_TITLE_CLASS}>Temporary Units</p>
              <div className="space-y-2">
                {selectedUnits.temporary.map((unit) => (
                  <ActiveUnitCard
                    key={unit.key}
                    unit={unit}
                    unitInformation={unitInformationByKey[unit.key]}
                    canInteract={canInteract}
                    killTargetOptions={killTargetOptions}
                    onSetOutOfAction={onSetOutOfAction}
                    onAdjustWounds={onAdjustWounds}
                    onSaveOverride={onSaveOverride}
                    onSaveUnitNotes={onSaveUnitNotes}
                    onRecordKill={onRecordKill}
                    onUseSingleUseItem={onUseSingleUseItem}
                    getUsedSingleUseItemCount={getUsedSingleUseItemCount}
                    activeItemActionKey={activeItemActionKey}
                    isSavingUnitConfig={Boolean(savingUnitKeys[unit.key])}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!selectedUnits.heroes.length &&
          !selectedHenchmenGroups.length &&
          !selectedUnits.hiredSwords.length &&
          !selectedUnits.temporary.length ? (
            <p className="text-sm text-muted-foreground">No units selected for this battle.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
