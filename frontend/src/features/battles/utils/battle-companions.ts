import type { EffectiveStats } from "@/features/warbands/types/companion-types";
import { uniqueBeasts, type CompanionSource } from "@/features/warbands/utils/companions";
import type { PrebattleUnit, UnitStats } from "../components/prebattle/prebattle-types";

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
