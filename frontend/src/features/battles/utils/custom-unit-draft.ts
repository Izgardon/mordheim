import type {
  CustomUnitDraft,
  PrebattleUnit,
  StatKey,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  toArmourSaveStat,
  toNumericStat,
  toUnitRating,
} from "@/features/battles/components/prebattle/prebattle-utils";

/** A battle-only key for a temporary unit. */
export function makeCustomUnitKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `custom:${crypto.randomUUID()}`;
  }
  return `custom:${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * A battle's stat box as typed (a battle holds numbers only): two digits, and a leading minus for
 * the armour save ("5+" is 5, "-" no save).
 */
export function typedBattleStat(key: StatKey, value: string) {
  if (key !== "armour_save") return value.replace(/[^\d]/g, "").slice(0, 2);
  const normalized = value.replace(/[^\d-]/g, "");
  const digits = normalized.replace(/-/g, "").slice(0, 2);
  return normalized.startsWith("-") ? `-${digits}` : digits;
}

/** The draft with one stat typed in (`typedBattleStat`). */
export function draftWithStat(
  draft: CustomUnitDraft,
  key: StatKey,
  value: string
): CustomUnitDraft {
  return { ...draft, stats: { ...draft.stats, [key]: typedBattleStat(key, value) } };
}

/** The temporary unit a draft describes, under `key`. */
export function customUnitFromDraft(draft: CustomUnitDraft, key: string): PrebattleUnit {
  return {
    key,
    id: key,
    kind: "custom",
    displayName: draft.name.trim(),
    unitType: draft.unitType.trim(),
    rating: toUnitRating(draft.rating),
    stats: {
      movement: toNumericStat(draft.stats.movement),
      weapon_skill: toNumericStat(draft.stats.weapon_skill),
      ballistic_skill: toNumericStat(draft.stats.ballistic_skill),
      strength: toNumericStat(draft.stats.strength),
      toughness: toNumericStat(draft.stats.toughness),
      wounds: toNumericStat(draft.stats.wounds),
      initiative: toNumericStat(draft.stats.initiative),
      attacks: toNumericStat(draft.stats.attacks),
      leadership: toNumericStat(draft.stats.leadership),
      armour_save: toArmourSaveStat(draft.stats.armour_save),
    },
  };
}
