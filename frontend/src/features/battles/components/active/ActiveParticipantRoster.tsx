import type { BattleParticipant, BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";

import ActiveUnitCard from "./ActiveUnitCard";
import type { ActiveBattleUnitOption } from "./active-utils";
import { getParticipantSelectedUnits } from "./active-utils";

type ActiveParticipantRosterProps = {
  participant: BattleParticipant;
  participantRoster?: ParticipantRoster;
  rosterLoading: boolean;
  rosterError?: string;
  ratingDisplay: string;
  unitInformationByKey: Record<string, BattleUnitInformationEntry>;
  killTargetOptions: ActiveBattleUnitOption[];
  canInteract: boolean;
  onSetOutOfAction: (unitKey: string, outOfAction: boolean) => Promise<void>;
  onRecordKill: (payload: {
    killerUnitKey: string;
    victimUnitKey?: string;
    victimName?: string;
    earnedXp: boolean;
  }) => Promise<void>;
  sectionIds?: Partial<Record<"heroes" | "henchmen" | "hired_swords" | "temporary", string>>;
};

const SECTION_TITLE_CLASS = "text-[0.76rem] font-bold uppercase tracking-[0.2em] text-muted-foreground";

export default function ActiveParticipantRoster({
  participant,
  participantRoster,
  rosterLoading,
  rosterError,
  ratingDisplay,
  unitInformationByKey,
  killTargetOptions,
  canInteract,
  onSetOutOfAction,
  onRecordKill,
  sectionIds,
}: ActiveParticipantRosterProps) {
  const selectedUnits = getParticipantSelectedUnits(participant, participantRoster);

  return (
    <div className="space-y-3">
      <div className="flex items-stretch justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{participant.user.label}</p>
          <p className="text-xs text-muted-foreground">{participant.warband.name}</p>
        </div>
        <div className="flex min-w-[9.5rem] items-center justify-end gap-2">
          <p className="text-xs text-muted-foreground">Rating:</p>
          <div className="flex h-9 min-w-[5rem] items-center justify-center rounded-md border border-border/40 bg-black/30 px-2 text-sm font-semibold text-foreground">
            {ratingDisplay}
          </div>
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
                    onRecordKill={onRecordKill}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {selectedUnits.henchmen.length ? (
            <section id={sectionIds?.henchmen} className="space-y-2 scroll-mt-28">
              <p className={SECTION_TITLE_CLASS}>Henchmen</p>
              <div className="space-y-2">
                {selectedUnits.henchmen.map((unit) => (
                  <ActiveUnitCard
                    key={unit.key}
                    unit={unit}
                    unitInformation={unitInformationByKey[unit.key]}
                    canInteract={canInteract}
                    killTargetOptions={killTargetOptions}
                    onSetOutOfAction={onSetOutOfAction}
                    onRecordKill={onRecordKill}
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
                    onRecordKill={onRecordKill}
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
                    onRecordKill={onRecordKill}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!selectedUnits.heroes.length &&
          !selectedUnits.henchmen.length &&
          !selectedUnits.hiredSwords.length &&
          !selectedUnits.temporary.length ? (
            <p className="text-sm text-muted-foreground">No units selected for this battle.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
