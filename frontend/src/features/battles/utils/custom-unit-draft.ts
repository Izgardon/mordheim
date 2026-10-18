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

/** The draft with one stat typed in: two digits, and a leading minus for the armour save. */
export function draftWithStat(
  draft: CustomUnitDraft,
  key: StatKey,
  value: string
): CustomUnitDraft {
  if (key === "armour_save") {
    const normalized = value.replace(/[^\d-]/g, "");
    const hasLeadingMinus = normalized.startsWith("-");
    const digits = normalized.replace(/-/g, "");
    const nextValue = hasLeadingMinus ? `-${digits.slice(0, 2)}` : digits.slice(0, 2);
    return { ...draft, stats: { ...draft.stats, armour_save: nextValue } };
  }
  return {
    ...draft,
    stats: { ...draft.stats, [key]: value.replace(/[^\d]/g, "").slice(0, 2) },
  };
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
