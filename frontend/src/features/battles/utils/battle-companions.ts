import type { EffectiveStats } from "@/features/warbands/types/companion-types";
import type { PrebattleUnit, UnitStats } from "../components/prebattle/prebattle-types";

type Mounted = Pick<PrebattleUnit, "effectiveStats">;

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
