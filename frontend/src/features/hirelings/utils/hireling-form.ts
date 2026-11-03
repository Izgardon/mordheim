import { skillAbbrevToType } from "@/features/warbands/utils/warband-utils";
import {
  bestiaryCorePayload,
  blankBestiaryCore,
  type BestiaryCoreValues,
} from "@/features/bestiary/utils/bestiary-form";
import { profileInputs } from "@/features/catalogue/utils/statblock";
import {
  draftOf,
  everyone,
  linesPayload,
  type WhoCanDraft,
} from "@/features/catalogue/utils/who-can-draft";

import { feeDraftOf, feeFromDraft, type FeeDraft } from "../components/fees/fee-draft";
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
  hire_fee: FeeDraft;
  upkeep_fee: FeeDraft;
  rating: string;
  available_skill_types: string[];
  stays: HirelingStays;
  payment_note: string;
  /** Who may hire him (the items rebuild), and the book's sentence about it. */
  who: WhoCanDraft;
  hire_note: string;
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
      hire_fee: feeDraftOf(null),
      upkeep_fee: feeDraftOf(null),
      rating: "",
      available_skill_types: [],
      stays: "always",
      payment_note: "",
      who: everyone(),
      hire_note: "",
    };
  }
  return {
    name: entry.name,
    description: entry.description ?? "",
    stats: profileInputs(entry),
    armour_save: text(entry.armour_save),
    large: Boolean(entry.large),
    caster: entry.caster || "No",
    race_id: entry.race_id ?? null,
    race_label: entry.race_label ?? "",
    hire_fee: feeDraftOf(entry.hire_fee),
    upkeep_fee: feeDraftOf(entry.upkeep_fee),
    rating: text(entry.rating),
    available_skill_types: entry.available_skill_types ?? [],
    stays: entry.stays ?? "always",
    payment_note: entry.payment_note ?? "",
    who: draftOf(entry),
    hire_note: entry.hire_note ?? "",
  };
}

/** A blank number is null; anything else is a number. */
const cost = (value: string) => (value.trim() === "" ? null : Number(value));

/** "4", "4+" or "-1" as a whole number (0+ included); blank or unreadable is no save. */
const armourSave = (value: string) => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

type Links = Pick<HirelingProfileWrite, "skill_ids" | "special_ids" | "spell_ids" | "item_entries">;

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
    hire_fee: feeFromDraft(values.hire_fee),
    upkeep_fee: feeFromDraft(values.upkeep_fee),
    rating: cost(values.rating),
    available_skill_types: values.available_skill_types,
    for_everyone: values.who.forEveryone,
    warbands: linesPayload(values.who),
    hire_note: values.hire_note.trim(),
    ...links,
    ...(config.hasPersonaTerms
      ? { stays: values.stays, payment_note: values.payment_note.trim() }
      : {}),
  };
}
