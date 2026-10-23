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

/**
 * A group's one stats line shows its mounted M and save only when every member shown rides; a
 * group riding in part shows foot stats, and each rider's mark says who rides.
 */
export function groupMountedStats(
  members: Mounted[],
  overrides: Partial<UnitStats> = {}
): EffectiveStats | null {
  if (members.length === 0 || members.some((member) => !member.effectiveStats)) return null;
  return mountedStats(members[0], overrides);
}
