import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";

import type { CombatOption } from "./CombatPicker";
import {
  BATTLE_SECTIONS,
  battleSectionLabel,
  battleSections,
  type BattleSections,
  type BattleSide,
  type BattleUnitView,
} from "./battle-units";

const HENCHMEN = BATTLE_SECTIONS.find((section) => section.key === "henchman")?.label ?? "";

const standing = (view: BattleUnitView) => view.status !== "out_of_action";

/**
 * A side's models as the Melee and Ranged pickers list them: heroes, hired swords, animals and
 * temporary units one by one, and a henchmen group once by its name (William, 24 Nov 2026: "we
 * only need to show the henchmen group names dont individual"), read from its first member still
 * standing. With `onlyStanding`, those out of action (and a group with nobody left) are left out.
 */
export function sideOptions(
  sections: BattleSections,
  { onlyStanding = false, side }: { onlyStanding?: boolean; side?: string } = {}
): CombatOption[] {
  const keep = (view: BattleUnitView) => !onlyStanding || standing(view);
  const heading = (label: string) => (side ? `${side} · ${label}` : label);
  const single = (view: BattleUnitView): CombatOption => ({
    key: view.unit.key,
    name: view.unit.displayName,
    stats: view.stats,
    section: heading(battleSectionLabel(view.unit)),
  });
  const groups = sections.groups.flatMap(({ group, members }): CombatOption[] => {
    const first = members.find(standing) ?? (onlyStanding ? undefined : members[0]);
    if (!first) return [];
    return [
      {
        key: `group:${group.id}`,
        name: group.name,
        stats: first.stats,
        section: heading(HENCHMEN),
      },
    ];
  });
  return [
    ...sections.heroes.filter(keep).map(single),
    ...groups,
    ...sections.swords.filter(keep).map(single),
    ...sections.pets.filter(keep).map(single),
    ...sections.temporary.filter(keep).map(single),
  ];
}

/** Yours (still standing) and theirs: every other side's, a neutral group once by its name. */
export function combatOptions(
  sections: BattleSections | null,
  otherSides: BattleSide[],
  rosters: Record<number, ParticipantRoster | undefined>
) {
  const yours = sections ? sideOptions(sections, { onlyStanding: true }) : [];
  // with more than one other side, each heading names whose models they are
  const several = otherSides.length > 1;
  const theirs = otherSides.flatMap((entry): CombatOption[] =>
    entry.kind === "neutral"
      ? [
          {
            key: `neutral:${entry.group.key}`,
            name: entry.group.name,
            stats: entry.group.stats ?? {},
            section: "Neutral groups",
          },
        ]
      : sideOptions(battleSections(entry.participant, rosters[entry.participant.user.id]), {
          side: several ? entry.name : undefined,
        })
  );
  return { yours, theirs };
}
