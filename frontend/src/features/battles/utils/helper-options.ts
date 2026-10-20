import type { ActiveMeleeUnitOption } from "@/features/battles/components/active/ActiveMeleeDialog";
import type { ActiveRangedUnitOption } from "@/features/battles/components/active/ActiveRangedDialog";
import {
  getParticipantSelectedUnits,
  toUnitInformationMap,
} from "@/features/battles/components/active/active-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

/** A participant's selected units still in action, with their battle stats and section. */
function unitsInAction(participant: BattleParticipant, roster: ParticipantRoster | undefined) {
  const selected = getParticipantSelectedUnits(participant, roster);
  const unitInformation = toUnitInformationMap(participant.unit_information_json);
  return [
    ...selected.heroes.map((unit) => ({ unit, sectionLabel: "Heroes" })),
    ...selected.henchmen.map((unit) => ({ unit, sectionLabel: "Henchmen" })),
    ...selected.hiredSwords.map((unit) => ({ unit, sectionLabel: "Hired Swords" })),
    ...selected.temporary.map((unit) => ({ unit, sectionLabel: "Temporary Units" })),
  ]
    .filter(({ unit }) => !unitInformation[unit.key]?.out_of_action)
    .map(({ unit, sectionLabel }) => ({
      unit,
      sectionLabel,
      stats: { ...unit.stats, ...(unitInformation[unit.key]?.stats_override ?? {}) },
    }));
}

/** The melee helper's units: yours, and every other warband's. */
export function meleeUnitOptions(
  participants: BattleParticipant[],
  rosters: Record<number, ParticipantRoster>,
  currentUserId: number | undefined
) {
  const options: { yours: ActiveMeleeUnitOption[]; others: ActiveMeleeUnitOption[] } = {
    yours: [],
    others: [],
  };
  if (!currentUserId) {
    return options;
  }
  for (const participant of participants) {
    for (const { unit, sectionLabel, stats } of unitsInAction(
      participant,
      rosters[participant.user.id]
    )) {
      const option: ActiveMeleeUnitOption = {
        value: `${participant.user.id}:${unit.key}`,
        label: `${unit.displayName} (${participant.warband.name})`,
        stats,
        defaultWeaponSkill: Number(stats.weapon_skill ?? 1),
        sectionLabel,
      };
      (participant.user.id === currentUserId ? options.yours : options.others).push(option);
    }
  }
  return options;
}

/** The ranged helper's units: your own. */
export function rangedUnitOptions(
  currentParticipant: BattleParticipant | null,
  rosters: Record<number, ParticipantRoster>
): ActiveRangedUnitOption[] {
  if (!currentParticipant) {
    return [];
  }
  return unitsInAction(currentParticipant, rosters[currentParticipant.user.id]).map(
    ({ unit, sectionLabel, stats }) => ({
      value: unit.key,
      label: unit.displayName,
      stats,
      defaultBallisticSkill: Number(stats.ballistic_skill ?? 1),
      sectionLabel,
    })
  );
}
