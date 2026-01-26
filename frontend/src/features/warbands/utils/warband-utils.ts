import type { HeroFormEntry, WarbandHero } from "../types/warband-types";

export const statFields = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;

export const skillFields = [
  { key: "C", label: "C" },
  { key: "Sh", label: "Sh" },
  { key: "A", label: "A" },
  { key: "St", label: "St" },
  { key: "Spc", label: "Spc" },
] as const;

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
  available_skills: skillFields.reduce(
    (acc, field) => ({ ...acc, [field.key]: Boolean(hero.available_skills?.[field.key]) }),
    {}
  ),
  items: hero.items ?? [],
  skills: hero.skills ?? [],
});

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
