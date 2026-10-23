import { skillAbbrevToType } from "@/features/warbands/utils/warband-utils";
import {
  bestiaryCorePayload,
  blankBestiaryCore,
  type BestiaryCoreValues,
} from "@/features/bestiary/utils/bestiary-form";
import { statInputs } from "@/features/catalogue/utils/statblock";

import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import type {
  HirelingProfileDetail,
  HirelingProfileWrite,
  HirelingStays,
} from "../types/hireling-catalogue-types";

/** The skill lists a hired sword may learn from: the five, and Cavalry (Blazing Saddles). */
export const HIRELING_SKILL_TYPES = [...Object.values(skillAbbrevToType), "Cavalry"];

/** What the hired-sword and dramatis-persona form edits. */
export type HirelingProfileValues = BestiaryCoreValues & {
  race_id: number | null;
  race_label: string;
  hire_cost: string;
  hire_cost_expression: string;
  upkeep_cost: string;
  upkeep_cost_expression: string;
  rating: string;
  available_skill_types: string[];
  stays: HirelingStays;
  payment_note: string;
};

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** An entry's values as the form edits them; a blank form for none. */
export function hirelingValuesOf(entry: HirelingProfileDetail | null): HirelingProfileValues {
  if (!entry) {
    return {
      ...blankBestiaryCore(),
      race_id: null,
      race_label: "",
      hire_cost: "",
      hire_cost_expression: "",
      upkeep_cost: "",
      upkeep_cost_expression: "",
      rating: "",
      available_skill_types: [],
      stays: "always",
      payment_note: "",
    };
  }
  return {
    name: entry.name,
    description: entry.description ?? "",
    stats: statInputs("0", {
      movement: text(entry.movement),
      weapon_skill: text(entry.weapon_skill),
      ballistic_skill: text(entry.ballistic_skill),
      strength: text(entry.strength),
      toughness: text(entry.toughness),
      wounds: text(entry.wounds),
      initiative: text(entry.initiative),
      attacks: text(entry.attacks),
      leadership: text(entry.leadership),
    }),
    armour_save: text(entry.armour_save),
    large: Boolean(entry.large),
    caster: entry.caster || "No",
    race_id: entry.race_id ?? null,
    race_label: entry.race_label ?? "",
    hire_cost: text(entry.hire_cost),
    hire_cost_expression: entry.hire_cost_expression ?? "",
    upkeep_cost: text(entry.upkeep_cost),
    upkeep_cost_expression: entry.upkeep_cost_expression ?? "",
    rating: text(entry.rating),
    available_skill_types: entry.available_skill_types ?? [],
    stays: entry.stays ?? "always",
    payment_note: entry.payment_note ?? "",
  };
}

/** A blank cost is null (no fee in gold); anything else is a number. */
const cost = (value: string) => (value.trim() === "" ? null : Number(value));

/** "4", "4+" or "-1" as a whole number (0+ included); blank or unreadable is no save. */
const armourSave = (value: string) => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

type Links = Pick<
  HirelingProfileWrite,
  "skill_ids" | "special_ids" | "spell_ids" | "item_entries" | "restriction_ids"
>;

/** The write body: trimmed text, numbers, every link list, and a dramatis persona's terms. */
export function hirelingPayload(
  config: HirelingCatalogueConfig,
  values: HirelingProfileValues,
  links: Links
): HirelingProfileWrite {
  return {
    ...bestiaryCorePayload(values),
    armour_save: armourSave(values.armour_save),
    race_id: values.race_id,
    race_label: values.race_label.trim(),
    hire_cost: cost(values.hire_cost),
    hire_cost_expression: values.hire_cost_expression.trim(),
    upkeep_cost: cost(values.upkeep_cost),
    upkeep_cost_expression: values.upkeep_cost_expression.trim(),
    rating: cost(values.rating),
    available_skill_types: values.available_skill_types,
    ...links,
    ...(config.hasPersonaTerms
      ? { stays: values.stays, payment_note: values.payment_note.trim() }
      : {}),
  };
}
