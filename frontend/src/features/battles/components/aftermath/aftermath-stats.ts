import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import { flattenRosterUnits } from "@/features/battles/components/prebattle/prebattle-utils";
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
  armour_save: "Sv",
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

/** A unit (or henchmen group) whose stats the battle changed, and whether they are kept. */
export type StatChangeRow = {
  key: string;
  name: string;
  /** The results the Keep tick sets: the unit's, or every member's of a henchmen group. */
  unitKeys: string[];
  changes: string[];
  kept: boolean;
};

/**
 * Every unit with a battle stat change (BATL-TWEAK-04, decision 6), in the draft's order: heroes
 * and hired swords one by one, a henchmen group once (its members share one Keep tick). The
 * changes become permanent at Ready only when kept.
 */
export function buildStatChangeRows(
  draft: BattlePostbattleState,
  roster: ParticipantRoster | undefined,
  unitInformation: Record<string, BattleUnitInformationEntry> | undefined
): StatChangeRow[] {
  const base = Object.fromEntries(flattenRosterUnits(roster).map((unit) => [unit.key, unit.stats]));
  const changesOf = (key: string) =>
    statChanges(base[key] ?? undefined, unitInformation?.[key]?.stats_override);
  const units = new Map<string, { name: string; unitKeys: string[] }>();
  for (const [key, result] of Object.entries(draft.unit_results)) {
    const group = result.unit_kind === "henchman" ? `group:${result.group_name}` : key;
    const entry = units.get(group) ?? {
      name: result.unit_kind === "henchman" ? result.group_name : result.unit_name,
      unitKeys: [],
    };
    entry.unitKeys.push(key);
    units.set(group, entry);
  }
  return [...units.values()].flatMap(({ name, unitKeys }) => {
    const changed = unitKeys.find((key) => changesOf(key).length > 0);
    if (!changed) return [];
    const kept = unitKeys.some((key) => Boolean(draft.unit_results[key]?.keep_stats));
    return [{ key: unitKeys[0], name, unitKeys, changes: changesOf(changed), kept }];
  });
}

/** The draft with a row's Keep tick set on each of its units. */
export function withKeptStats(draft: BattlePostbattleState, row: StatChangeRow, keep: boolean) {
  const unit_results = { ...draft.unit_results };
  for (const key of row.unitKeys) {
    if (unit_results[key]) unit_results[key] = { ...unit_results[key], keep_stats: keep };
  }
  return { ...draft, unit_results };
}
