import type { EffectiveStats } from "@/features/warbands/types/companion-types";
import { uniqueBeasts, type CompanionSource } from "@/features/warbands/utils/companions";
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

/** A roster unit's mount, then its pets, as the sources of the entries they bring (step 5). */
export const battleCompanionSources = (
  unit: Pick<PrebattleUnit, "mount" | "pets">
): CompanionSource[] =>
  uniqueBeasts([
    ...(unit.mount ? [{ ...unit.mount, kind: "mount" as const }] : []),
    ...(unit.pets ?? []).map((pet) => ({ ...pet, kind: "pet" as const })),
  ]);

type Mounted = Pick<PrebattleUnit, "effectiveStats">;
type Dismountable = { dismounted?: boolean } | undefined;

/**
 * A unit as it rides now: a rider marked Dismounted for the rest of the battle (step 5) shows and
 * fights with his foot M and save, and his mount's entries no longer apply.
 */
export const onFoot = <T extends Pick<PrebattleUnit, "effectiveStats" | "mount">>(
  unit: T,
  info?: Dismountable
): T => (info?.dismounted ? { ...unit, effectiveStats: null, mount: null } : unit);

/**
 * A rider's mounted M and save as his roster entry carries them (display only), less any a battle
 * stat change sets: that change wins. Null on foot.
 */
export function mountedStats(
  unit: Mounted,
  overrides: Partial<UnitStats> = {}
): EffectiveStats | null {
  const mounted = unit.effectiveStats;
  if (!mounted) return null;
  return {
    movement: overrides.movement !== undefined ? null : mounted.movement,
    armour_save: overrides.armour_save !== undefined ? null : mounted.armour_save,
  };
}

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

const sameMounted = (left: EffectiveStats | null | undefined, right: EffectiveStats) =>
  left?.movement === right.movement && left?.armour_save === right.armour_save;

/**
 * A group's one stats line shows its mounted M and save only when every member shown rides with
 * the same ones; a group riding in part, or on mounts of different Move, shows foot stats, and
 * each rider's mark says who rides what.
 */
export function groupMountedStats(
  members: Mounted[],
  overrides: Partial<UnitStats> = {}
): EffectiveStats | null {
  const first = members[0]?.effectiveStats;
  if (!first || members.some((member) => !sameMounted(member.effectiveStats, first))) return null;
  return mountedStats(members[0], overrides);
}
