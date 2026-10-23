import { unitMountBonus } from "./companions";

import type { HenchmenGroup, WarbandHero, WarbandHireling } from "../types/warband-types";

export const statFields = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;

export const skillFields = [
  { key: "C", label: "C" },
  { key: "Sh", label: "Sh" },
  { key: "A", label: "A" },
  { key: "St", label: "St" },
  { key: "Sp", label: "Sp" },
  { key: "Spc", label: "Spc" },
] as const;

/** Abbreviation → full skill-type name used in the skill catalog. */
export const skillAbbrevToType: Record<string, string> = {
  C: "Combat",
  Sh: "Shooting",
  A: "Academic",
  St: "Strength",
  Sp: "Speed",
};

/** Reverse: full name → abbreviation. */
const skillTypeToAbbrev: Record<string, string> = Object.fromEntries(
  Object.entries(skillAbbrevToType).map(([k, v]) => [v, k])
);

const standardAbbrevs = new Set(Object.keys(skillAbbrevToType));

/**
 * Convert the form's `available_skills` record (checkbox booleans keyed by
 * abbreviation + special type names) into a flat list of full type names for
 * the backend payload.
 *
 * e.g. { C: true, Sh: false, A: true, Spc: true, "Necromancy": true }
 *   → ["Combat", "Academic", "Necromancy"]
 */
export const buildAvailableSkillsPayload = (formSkills: Record<string, boolean>): string[] => {
  const types: string[] = [];
  for (const [key, enabled] of Object.entries(formSkills)) {
    if (!enabled) continue;
    if (key === "Spc") continue; // meta flag, not a real type
    const fullName = skillAbbrevToType[key];
    if (fullName) {
      types.push(fullName);
    } else {
      // already a full type name (special list)
      types.push(key);
    }
  }
  return types;
};

/**
 * Convert backend `available_skills` (list of type names OR legacy dict) into
 * the form's checkbox record.
 */
export const parseAvailableSkills = (raw: unknown): Record<string, boolean> => {
  // New format: string[]
  if (Array.isArray(raw)) {
    const result: Record<string, boolean> = {};
    let hasSpecial = false;
    for (const typeName of raw as string[]) {
      const abbrev = skillTypeToAbbrev[typeName];
      if (abbrev) {
        result[abbrev] = true;
      } else {
        // non-standard type → special list entry
        result[typeName] = true;
        hasSpecial = true;
      }
    }
    // fill in false for missing standard abbrevs
    for (const abbrev of standardAbbrevs) {
      if (!(abbrev in result)) result[abbrev] = false;
    }
    result.Spc = hasSpecial;
    return result;
  }

  // Legacy format: { C: true, Sh: false, ... }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const dict = raw as Record<string, boolean>;
    const result: Record<string, boolean> = {};
    for (const field of skillFields) {
      result[field.key] = Boolean(dict[field.key]);
    }
    // carry over any non-standard keys (special type names)
    for (const [key, val] of Object.entries(dict)) {
      if (!(key in result)) {
        result[key] = Boolean(val);
      }
    }
    return result;
  }

  // fallback: everything off
  return skillFields.reduce((acc, field) => ({ ...acc, [field.key]: false }), {});
};

export const statFieldMap = {
  M: "movement",
  WS: "weapon_skill",
  BS: "ballistic_skill",
  S: "strength",
  T: "toughness",
  W: "wounds",
  I: "initiative",
  A: "attacks",
  Ld: "leadership",
} as const;

export const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) {
      return 0;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const toNullableNumber = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

// ── Warband rating ──────────────────────────────────────────────────────

/** Each rider's mount bonus, as the server adds it to the rating (`unitMountBonus`). */
export const mountsRating = (
  heroes: WarbandHero[],
  hirelings: WarbandHireling[],
  henchmenGroups: HenchmenGroup[]
) =>
  [...heroes, ...hirelings, ...henchmenGroups].reduce((sum, unit) => sum + unitMountBonus(unit), 0);

export const calculateWarbandRating = (
  heroes: WarbandHero[],
  hirelings: WarbandHireling[],
  henchmenGroups: HenchmenGroup[],
  fallbackRating?: number
): number => {
  const heroRating = heroes.reduce((total, hero) => {
    const base = hero.large ? 20 : 5;
    const xp = toNumber(hero.xp);
    return total + base + xp;
  }, 0);

  const hirelingRating = hirelings.reduce((total, hs) => {
    const base = toNumber(hs.rating ?? 0);
    const xp = toNumber(hs.xp);
    return total + base + xp;
  }, 0);

  const henchmenRating = henchmenGroups.reduce((total, group) => {
    const count = group.henchmen?.length ?? 0;
    if (!count) return total;
    const base = group.large ? 20 : 5;
    const xp = toNumber(group.xp);
    return total + count * (base + xp);
  }, 0);

  if (heroes.length || hirelings.length || henchmenGroups.length) {
    return (
      heroRating + hirelingRating + henchmenRating + mountsRating(heroes, hirelings, henchmenGroups)
    );
  }
  return typeof fallbackRating === "number" ? fallbackRating : 0;
};

// ── Warband unit count ───────────────────────────────────────────────────

/**
 * Returns the total unit count for the purposes of max_units enforcement.
 * Heroes count 1 each. Each individual henchman in a group counts 1.
 * Only blood-pacted hired swords count (not regular hired swords).
 */
export const getWarbandUnitCount = (
  heroes: readonly unknown[],
  hirelings: readonly { blood_pacted?: boolean | null }[],
  henchmenGroups: readonly { henchmen?: readonly unknown[] | null }[]
): number => {
  const heroCount = heroes.length;
  const bloodPactedCount = hirelings.filter((hs) => hs.blood_pacted).length;
  const henchmenCount = henchmenGroups.reduce(
    (total, group) => total + (group.henchmen?.length ?? 0),
    0
  );
  return heroCount + bloodPactedCount + henchmenCount;
};

// ── Trade formatting ────────────────────────────────────────────────────

export const formatTradeDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleDateString();
};

// ── Unit price calculation ──────────────────────────────────────────────

/** Base price plus item costs (heroes and hired swords; hired sword upkeep is separate). */
export const calculateUnitTotalPrice = (
  hero: Pick<WarbandHero, "price" | "items">
): {
  basePrice: number;
  itemsPrice: number;
  totalPrice: number;
} => {
  const basePrice = Number(hero.price ?? 0) || 0;
  const itemsPrice = (hero.items ?? []).reduce((sum, item) => {
    const cost = Number(item.cost ?? 0);
    return sum + (Number.isFinite(cost) ? cost : 0);
  }, 0);
  return { basePrice, itemsPrice, totalPrice: basePrice + itemsPrice };
};

// ── Item grouping ───────────────────────────────────────────────────────

export type GroupedItem<T extends { id: number; name: string }> = {
  item: T;
  count: number;
};

export const groupItemsById = <T extends { id: number; name: string }>(
  items: T[]
): GroupedItem<T>[] =>
  Object.values(
    items.reduce<Record<number, GroupedItem<T>>>((acc, item) => {
      if (acc[item.id]) {
        acc[item.id].count += 1;
      } else {
        acc[item.id] = { item, count: 1 };
      }
      return acc;
    }, {})
  );
