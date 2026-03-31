import { Crosshair, Swords } from "lucide-react";
import type { BattleParticipant, BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import { Tooltip } from "@/components/ui/tooltip";
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
  onOpenMelee: () => void;
  onOpenRanged: () => void;
  onOpenCriticalHits: () => void;
  meleeDisabled?: boolean;
  rangedDisabled?: boolean;
  unitInformationByKey: Record<string, BattleUnitInformationEntry>;
  killTargetOptions: ActiveBattleUnitOption[];
  canInteract: boolean;
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onAdjustWounds: (unit: PrebattleUnit, delta: number) => Promise<void>;
  onSaveOverride: (unitKey: string, override: UnitOverride | undefined) => Promise<void>;
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
  onOpenMelee,
  onOpenRanged,
  onOpenCriticalHits,
  meleeDisabled = false,
  rangedDisabled = false,
  unitInformationByKey,
  killTargetOptions,
  canInteract,
  onSetOutOfAction,
  onAdjustWounds,
  onSaveOverride,
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

  const headerIconButtonClass =
    "battle-toolbar-button icon-button flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-3">
      <div className="battle-card-strong battle-selected-card flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-h-9 flex-col justify-center">
          <p className="text-sm font-semibold text-foreground">{participant.user.label}</p>
          <p className="text-xs text-muted-foreground">{participant.warband.name}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Tooltip
            trigger={
              <button
                type="button"
                className={headerIconButtonClass}
                onClick={onOpenRanged}
                disabled={rangedDisabled}
                aria-label="Open ranged helper"
              >
                <BowIcon className="h-5 w-5" />
              </button>
            }
            content="Ranged"
          />
          <Tooltip
            trigger={
              <button
                type="button"
                className={headerIconButtonClass}
                onClick={onOpenMelee}
                disabled={meleeDisabled}
                aria-label="Open melee helper"
              >
                <Swords className="h-5 w-5" />
              </button>
            }
            content="Melee"
          />
          <Tooltip
            trigger={
              <button
                type="button"
                className={headerIconButtonClass}
                onClick={onOpenCriticalHits}
                aria-label="Open critical hit reference"
              >
                <Crosshair className="h-5 w-5" />
              </button>
            }
            content="Critical Hits"
          />
        </div>
      </div>

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

function BowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 4c5 3 8 8 8 8s-3 5-8 8" />
      <path d="M6 4v16" />
      <path d="M4 12h16" />
      <path d="M16 8l4 4-4 4" />
    </svg>
  );
}
