import type { BattleRosterCompanion } from "@/features/battles/types/battle-types";
import {
  DEFAULT_STATS,
  type ParticipantRoster,
  type PrebattleUnit,
  type UnitStats,
} from "../components/prebattle/prebattle-types";

const petModel = (pet: BattleRosterCompanion, ownerKey: string, ownerName: string) => ({
  key: pet.key!,
  id: pet.key!,
  kind: "pet" as const,
  displayName: pet.name,
  unitType: `Pet of ${ownerName}`,
  stats: pet.stats ?? DEFAULT_STATS,
  items: [],
  singleUseItems: [],
  skills: pet.skills ?? [],
  specials: pet.specials ?? [],
  spells: pet.spells ?? [],
  ownerKey,
});

/**
 * The roster's pets that fight as their own models (step 5: a keyed pet, one with a profile),
 * each named for its owner: the heroes', the hired swords', then each henchmen group's own
 * (`group:<id>`). They follow their owners after the battle: no result of their own.
 */
export function rosterPetModels(
  roster: Pick<ParticipantRoster, "heroes" | "hirelings" | "henchmenGroups">
): PrebattleUnit[] {
  const owners = [
    ...[...roster.heroes, ...roster.hirelings].map((unit) => ({
      key: unit.key,
      name: unit.displayName,
      pets: unit.pets,
    })),
    ...roster.henchmenGroups.map((group) => ({
      key: `group:${group.id}`,
      name: group.name,
      pets: group.pets,
    })),
  ];
  return owners.flatMap((owner) =>
    (owner.pets ?? []).filter((pet) => pet.key).map((pet) => petModel(pet, owner.key, owner.name))
  );
}

type Dismountable = { dismounted?: boolean } | undefined;

/**
 * A unit's stats as the battle helpers use them: its own, the mount's M and save while it rides
 * (the roster's `effectiveStats`; his foot ones once dismounted), then any battle stat change,
 * which wins.
 */
export function helperStats(
  unit: Pick<PrebattleUnit, "stats" | "effectiveStats">,
  overrides: Partial<UnitStats> = {},
  info?: Dismountable
): UnitStats {
  const riding = Object.fromEntries(
    Object.entries((info?.dismounted ? null : unit.effectiveStats) ?? {}).filter(
      ([, value]) => value !== null
    )
  );
  return { ...unit.stats, ...riding, ...overrides };
}
