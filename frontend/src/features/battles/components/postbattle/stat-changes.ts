import type { PostbattleRenderableGroup } from "@/features/battles/components/postbattle/postbattle-utils";
import type { UnitStats } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattlePostbattleState,
  BattleUnitInformationEntry,
  BattleUnitStats,
} from "@/features/battles/types/battle-types";

const STAT_LABELS: Record<keyof BattleUnitStats, string> = {
  movement: "M",
  weapon_skill: "WS",
  ballistic_skill: "BS",
  strength: "S",
  toughness: "T",
  wounds: "W",
  initiative: "I",
  attacks: "A",
  leadership: "Ld",
  armour_save: "AS",
};

const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

/** "WS 4 → 5" for each stat the battle changed. */
export function statChanges(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined
) {
  return Object.entries(override ?? {})
    .filter(([stat, value]) => value !== undefined && base?.[stat] !== value)
    .map(
      ([stat, value]) =>
        `${STAT_LABELS[stat as keyof BattleUnitStats] ?? stat} ${shown(base?.[stat])} → ${shown(value)}`
    );
}

/** A unit (or henchmen group) the battle changed the stats of, and whether they are kept. */
export type StatChangeRow = {
  key: string;
  unitName: string;
  /** The units the Keep tick sets: the unit, or every member of a henchmen group. */
  unitKeys: string[];
  changes: string[];
  kept: boolean;
};

/**
 * Every unit with a battle stat change, in roster order (BATL-TWEAK-04, decision 6): heroes and
 * hired swords one by one, a henchmen group once (its members share one Keep tick).
 */
export function buildStatChangeRows({
  groups,
  draft,
  baseStatsByUnitKey,
  unitInformation,
}: {
  groups: PostbattleRenderableGroup[];
  draft: BattlePostbattleState | null;
  baseStatsByUnitKey: Record<string, UnitStats>;
  unitInformation: Record<string, BattleUnitInformationEntry>;
}): StatChangeRow[] {
  const changesOf = (unitKey: string) =>
    statChanges(baseStatsByUnitKey[unitKey], unitInformation[unitKey]?.stats_override);
  const units = groups.flatMap((group) =>
    group.unitKind === "henchman"
      ? [{ unitName: group.label, unitKeys: group.rows.map((row) => row.unitKey) }]
      : group.rows.map((row) => ({ unitName: row.unitName, unitKeys: [row.unitKey] }))
  );
  return units.flatMap(({ unitName, unitKeys }) => {
    const changedKey = unitKeys.find((unitKey) => changesOf(unitKey).length > 0);
    if (!changedKey) {
      return [];
    }
    return [
      {
        key: unitKeys[0],
        unitName,
        unitKeys,
        changes: changesOf(changedKey),
        kept: unitKeys.some((unitKey) => Boolean(draft?.unit_results[unitKey]?.keep_stats)),
      },
    ];
  });
}
