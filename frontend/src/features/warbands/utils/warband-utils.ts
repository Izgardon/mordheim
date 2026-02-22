import type { Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { Special } from "@/features/special/types/special-types";
import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
  HeroCaster,
  HeroFormEntry,
  HiredSwordFormEntry,
  WarbandHero,
  WarbandHiredSword,
  WarbandTrade,
} from "../types/warband-types";

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
export const buildAvailableSkillsPayload = (
  formSkills: Record<string, boolean>
): string[] => {
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
export const parseAvailableSkills = (
  raw: unknown
): Record<string, boolean> => {
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

export type NewHeroForm = {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  price: string;
  xp: string;
};

export type NewHiredSwordForm = {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  price: string;
  upkeep_price: string;
  rating: string;
  xp: string;
  caster: HeroCaster;
  items: Item[];
  skills: Skill[];
  spells: Spell[];
  specials: Special[];
};

export const mapHeroToForm = (hero: WarbandHero): HeroFormEntry => ({
  id: hero.id,
  name: hero.name ?? "",
  unit_type: hero.unit_type ?? "",
  race_id: hero.race_id ?? null,
  race_name: hero.race_name ?? "",
  stats: statFields.reduce(
    (acc, key) => {
      const statKey = statFieldMap[key];
      const value = hero[statKey as keyof WarbandHero];
      return {
        ...acc,
        [key]: value !== null && value !== undefined ? String(value) : "",
      };
    },
    {}
  ),
  xp: hero.xp?.toString() ?? "0",
  price: hero.price?.toString() ?? "0",
  armour_save: hero.armour_save ?? "",
  deeds: hero.deeds ?? "",
  large: Boolean(hero.large),
  caster: normalizeCaster(hero.caster),
  half_rate: Boolean(hero.half_rate),
  available_skills: parseAvailableSkills(hero.available_skills),
  items: hero.items ?? [],
  skills: hero.skills ?? [],
  spells: hero.spells ?? [],
  specials: hero.specials ?? [],
});

export const mapHiredSwordToForm = (hiredSword: WarbandHiredSword): HiredSwordFormEntry => ({
  id: hiredSword.id,
  name: hiredSword.name ?? "",
  unit_type: hiredSword.unit_type ?? "",
  race_id: hiredSword.race_id ?? null,
  race_name: hiredSword.race_name ?? "",
  stats: statFields.reduce(
    (acc, key) => {
      const statKey = statFieldMap[key];
      const value = hiredSword[statKey as keyof WarbandHiredSword];
      return {
        ...acc,
        [key]: value !== null && value !== undefined ? String(value) : "",
      };
    },
    {}
  ),
  xp: hiredSword.xp?.toString() ?? "0",
  price: hiredSword.price?.toString() ?? "0",
  upkeep_price: hiredSword.upkeep_price?.toString() ?? "0",
  rating: hiredSword.rating?.toString() ?? "0",
  armour_save: hiredSword.armour_save ?? "",
  deeds: hiredSword.deeds ?? "",
  large: Boolean(hiredSword.large),
  caster: normalizeCaster(hiredSword.caster),
  half_rate: Boolean(hiredSword.half_rate),
  blood_pacted: Boolean(hiredSword.blood_pacted),
  available_skills: parseAvailableSkills(hiredSword.available_skills),
  items: hiredSword.items ?? [],
  skills: hiredSword.skills ?? [],
  spells: hiredSword.spells ?? [],
  specials: hiredSword.specials ?? [],
});

const normalizeCaster = (
  value: WarbandHero["caster"] | boolean | null | undefined
): HeroCaster => {
  if (value === true) {
    return "Wizard";
  }
  if (!value) {
    return "No";
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return "No";
    }
    const lower = normalized.toLowerCase();
    if (lower === "wizard") {
      return "Wizard";
    }
    if (lower === "priest") {
      return "Priest";
    }
    if (lower === "no") {
      return "No";
    }
  }
  return "No";
};

const heroFieldLabels = {
  name: "Name",
  unit_type: "Type",
  race_id: "Race",
} as const;

export type HeroValidationField = keyof typeof heroFieldLabels;

export type HeroValidationError = {
  fields: HeroValidationField[];
  message: string;
};

export const buildStatPayload = (hero: HeroFormEntry) =>
  statFields.reduce((acc, key) => {
    const value = hero.stats[key];
    if (String(value).trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return { ...acc, [statFieldMap[key]]: parsed };
      }
    }
    return acc;
  }, {} as Record<string, number>);

export const validateHeroForm = (hero: HeroFormEntry): HeroValidationError | null => {
  const missing: HeroValidationField[] = [];
  if (!hero.name || !hero.name.trim()) {
    missing.push("name");
  }
  if (!hero.unit_type || !hero.unit_type.trim()) {
    missing.push("unit_type");
  }
  if (!hero.race_id) {
    missing.push("race_id");
  }
  if (missing.length === 0) {
    return null;
  }
  const labels = missing.map((field) => heroFieldLabels[field]);
  return {
    fields: missing,
    message: `Missing: ${labels.join(", ")}`,
  };
};

export const validateHiredSwordForm = (hiredSword: HiredSwordFormEntry): HeroValidationError | null =>
  validateHeroForm(hiredSword);

export const mapHenchmenGroupToForm = (group: HenchmenGroup): HenchmenGroupFormEntry => ({
  id: group.id,
  name: group.name ?? "",
  unit_type: group.unit_type ?? "",
  race_id: group.race_id ?? null,
  race_name: group.race_name ?? "",
  stats: statFields.reduce(
    (acc, key) => {
      const statKey = statFieldMap[key];
      const value = group[statKey as keyof HenchmenGroup];
      return {
        ...acc,
        [key]: value !== null && value !== undefined ? String(value) : "",
      };
    },
    {}
  ),
  xp: group.xp?.toString() ?? "0",
  max_size: group.max_size?.toString() ?? "5",
  price: group.price?.toString() ?? "0",
  armour_save: group.armour_save ?? "",
  deeds: group.deeds ?? "",
  large: Boolean(group.large),
  half_rate: Boolean(group.half_rate),
  items: group.items ?? [],
  skills: group.skills ?? [],
  specials: group.specials ?? [],
  henchmen: group.henchmen ?? [],
});

export type HenchmenGroupValidationField = "name" | "unit_type" | "race_id" | "henchmen_names";

export type HenchmenGroupValidationError = {
  fields: HenchmenGroupValidationField[];
  message: string;
};

const henchmenGroupFieldLabels: Record<HenchmenGroupValidationField, string> = {
  name: "Name",
  unit_type: "Type",
  race_id: "Race",
  henchmen_names: "Henchmen names",
};

export const validateHenchmenGroupForm = (group: HenchmenGroupFormEntry): HenchmenGroupValidationError | null => {
  const missing: HenchmenGroupValidationField[] = [];
  if (!group.name || !group.name.trim()) {
    missing.push("name");
  }
  if (!group.unit_type || !group.unit_type.trim()) {
    missing.push("unit_type");
  }
  if (!group.race_id) {
    missing.push("race_id");
  }
  if (group.henchmen.some((h) => !h.name?.trim())) {
    missing.push("henchmen_names");
  }
  if (missing.length === 0) {
    return null;
  }
  const labels = missing.map((field) => henchmenGroupFieldLabels[field]);
  return {
    fields: missing,
    message: `Missing: ${labels.join(", ")}`,
  };
};

export const buildHenchmenGroupStatPayload = (group: HenchmenGroupFormEntry) =>
  statFields.reduce((acc, key) => {
    const value = group.stats[key];
    if (String(value).trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return { ...acc, [statFieldMap[key]]: parsed };
      }
    }
    return acc;
  }, {} as Record<string, number>);

const EXPENSE_ACTIONS = new Set([
  "buy",
  "bought",
  "recruit",
  "recruited",
  "hired",
  "hire",
  "upkeep",
  "trade sent",
]);

/** Returns the trade price with correct sign: negative for expenses, positive for income. */
export const getSignedTradePrice = (trade: WarbandTrade): number => {
  const price = trade.price || 0;
  if (EXPENSE_ACTIONS.has(trade.action.trim().toLowerCase())) {
    return -Math.abs(price);
  }
  return Math.abs(price);
};

// ── Warband rating ──────────────────────────────────────────────────────

export const calculateWarbandRating = (
  heroes: WarbandHero[],
  hiredSwords: WarbandHiredSword[],
  henchmenGroups: HenchmenGroup[],
  fallbackRating?: number,
): number => {
  const heroRating = heroes.reduce((total, hero) => {
    const base = hero.large ? 20 : 5;
    const xp = toNumber(hero.xp);
    return total + base + xp;
  }, 0);

  const hiredSwordRating = hiredSwords.reduce((total, hs) => {
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

  if (heroes.length || hiredSwords.length || henchmenGroups.length) {
    return heroRating + hiredSwordRating + henchmenRating;
  }
  return typeof fallbackRating === "number" ? fallbackRating : 0;
};

// ── Trade formatting ────────────────────────────────────────────────────

const PAST_TENSE_MAP: Record<string, string> = {
  buy: "Bought",
  bought: "Bought",
  sell: "Sold",
  sold: "Sold",
  hire: "Hired",
  hired: "Hired",
  recruit: "Recruited",
  recruited: "Recruited",
  upkeep: "Upkeep",
  exploration: "Exploration",
  reward: "Reward",
  "starting gold": "Starting Gold",
};

export const formatTradeAction = (action: string): string => {
  const normalized = action.trim().toLowerCase();
  return PAST_TENSE_MAP[normalized] || action.trim();
};

export const formatTradeDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleDateString();
};

// ── Hero price calculation ──────────────────────────────────────────────

export const calculateHeroTotalPrice = (hero: WarbandHero): {
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
  items: T[],
): GroupedItem<T>[] =>
  Object.values(
    items.reduce<Record<number, GroupedItem<T>>>((acc, item) => {
      if (acc[item.id]) {
        acc[item.id].count += 1;
      } else {
        acc[item.id] = { item, count: 1 };
      }
      return acc;
    }, {}),
  );

// ── XP save helpers ────────────────────────────────────────────────────

import {
  updateWarbandHero,
  updateWarbandHiredSword,
  updateWarbandHenchmenGroup,
} from "../api/warbands-api";

export const createHeroXpSaver = (
  warbandId: number,
  hero: WarbandHero,
  onUpdated?: (updated: WarbandHero) => void,
) => async (newXp: number): Promise<number> => {
  const updated = await updateWarbandHero(warbandId, hero.id, {
    name: hero.name, unit_type: hero.unit_type, race: hero.race_id ?? null, price: hero.price, xp: newXp,
  });
  onUpdated?.(updated);
  return Number(updated.xp ?? newXp) || 0;
};

export const createHiredSwordXpSaver = (
  warbandId: number,
  hiredSword: WarbandHiredSword,
  onUpdated?: (updated: WarbandHiredSword) => void,
) => async (newXp: number): Promise<number> => {
  const updated = await updateWarbandHiredSword(warbandId, hiredSword.id, {
    name: hiredSword.name, unit_type: hiredSword.unit_type, race: hiredSword.race_id ?? null,
    price: hiredSword.price, upkeep_price: hiredSword.upkeep_price ?? 0, xp: newXp,
  });
  onUpdated?.(updated);
  return Number(updated.xp ?? newXp) || 0;
};

export const createHenchmenGroupXpSaver = (
  warbandId: number,
  group: HenchmenGroup,
  onUpdated?: (updated: HenchmenGroup) => void,
) => async (newXp: number): Promise<number> => {
  const updated = await updateWarbandHenchmenGroup(warbandId, group.id, {
    name: group.name, unit_type: group.unit_type, race: group.race_id ?? null, price: group.price, xp: newXp,
  });
  onUpdated?.(updated);
  return Number(updated.xp ?? newXp) || 0;
};

