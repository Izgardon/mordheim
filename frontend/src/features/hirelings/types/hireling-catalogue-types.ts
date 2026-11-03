import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";
import type { WrittenStats } from "@/features/catalogue/utils/statblock";
import type { AccessLine, AccessLineInput, Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

import type { Fee } from "../fees";

/** How long a dramatis persona stays with the warband that hires him. */
export type HirelingStays = "always" | "one_battle";

/**
 * A hired sword or a dramatis persona as the catalogue lists it (`GET hired-swords/`,
 * `GET dramatis-personae/`): the profile, its race and its hire terms. The race is the catalogue's
 * when one matched (`race_id`, `race_name`); `race_label` always keeps the source's text.
 */
export type HirelingProfile = CatalogueBadgeFields & {
  id: number;
  campaign_id: number | null;
  name: string;
  description: string;
  movement: number | null;
  weapon_skill: number | null;
  ballistic_skill: number | null;
  strength: number | null;
  toughness: number | null;
  wounds: number | null;
  initiative: number | null;
  attacks: number | null;
  leadership: number | null;
  /** Stats written as the book prints them ("2D6", "-"), by field. */
  written_stats?: WrittenStats;
  armour_save: number | null;
  large: boolean;
  caster: string;
  race_id: number | null;
  race_name: string | null;
  race_label: string;
  /** What hiring him costs and what keeping him costs after each battle (structured fees). */
  hire_fee: Fee;
  upkeep_fee: Fee;
  rating: number | null;
  available_skill_types: string[];
  grade?: string;
  /** Dramatis personae only. */
  stays?: HirelingStays;
  /** Dramatis personae only: what he is paid in ("25 gc or 1 shard", a favour). */
  payment_note?: string;
  /** Who may hire him (the items rebuild): everyone (minus the excluded) or the warbands named. */
  for_everyone: boolean;
  warbands: AccessLine[];
  /** The book's sentence about who hires him, shown and never checked. */
  hire_note: string;
};

export type HirelingEquipment = { item: Item; quantity: number };

/** One entry (`GET <kind>/:id/` and every write's answer): the row and what it knows and carries. */
export type HirelingProfileDetail = HirelingProfile & {
  skills: Skill[];
  specials: Special[];
  spells: Spell[];
  equipment: HirelingEquipment[];
};

/**
 * A create or an edit. A list that is sent replaces that list; one left out stays. A book entry's
 * edit names the campaign, and its first edit makes the campaign's version.
 */
export type HirelingProfileWrite = {
  campaign_id?: number;
  name: string;
  description: string;
  /** Each stat as a number or as written ("2D6", "-"): the server reads it. */
  movement: number | string;
  weapon_skill: number | string;
  ballistic_skill: number | string;
  strength: number | string;
  toughness: number | string;
  wounds: number | string;
  initiative: number | string;
  attacks: number | string;
  leadership: number | string;
  armour_save: number | null;
  large: boolean;
  caster: string;
  race_id: number | null;
  race_label: string;
  hire_fee: Fee;
  upkeep_fee: Fee;
  rating: number | null;
  available_skill_types: string[];
  skill_ids: number[];
  special_ids: number[];
  spell_ids: number[];
  item_entries: { item_id: number; quantity: number }[];
  for_everyone: boolean;
  warbands: AccessLineInput[];
  hire_note: string;
  stays?: HirelingStays;
  payment_note?: string;
};
