import {
  DEFAULT_CUSTOM_UNIT_DRAFT,
  type CustomUnitDraft,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleUnitStats } from "@/features/battles/types/battle-types";
import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";
import { STAT_FIELDS } from "@/features/catalogue/utils/statblock";

/**
 * A bestiary creature's profile as a battle holds it: numbers only, so a written stat with none
 * ("2D6", "-") is left out; undefined for a creature with no profile.
 */
export function beastStats(beast: BestiaryEntrySummary): Partial<BattleUnitStats> | undefined {
  if (!beast.has_profile) return undefined;
  return {
    ...Object.fromEntries(
      STAT_FIELDS.flatMap(({ key }) => (beast[key] === null ? [] : [[key, beast[key]]]))
    ),
    armour_save: beast.armour_save,
  };
}

/** A creature's wounds in a battle: its profile's, 1 to 10. */
export const beastWounds = (beast: BestiaryEntrySummary | undefined) =>
  Math.max(1, Math.min(10, beast?.wounds || 1));

/** A temporary unit for your warband, filled from a bestiary creature: its name, type, rating and profile. */
export function beastDraft(beast: BestiaryEntrySummary): CustomUnitDraft {
  const stats = beastStats(beast) ?? {};
  const shown = (value: number | null | undefined) =>
    typeof value === "number" ? String(value) : "";
  return {
    name: beast.name,
    unitType: beast.name,
    rating: shown(beast.rating),
    stats: Object.fromEntries(
      Object.keys(DEFAULT_CUSTOM_UNIT_DRAFT.stats).map((key) => [
        key,
        shown(stats[key as keyof BattleUnitStats]),
      ])
    ) as CustomUnitDraft["stats"],
  };
}
