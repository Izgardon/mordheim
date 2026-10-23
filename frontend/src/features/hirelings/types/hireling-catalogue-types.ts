import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";
import type { Item, RestrictionLink } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

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
  campaign_type_id?: number | null;
  name: string;
  description: string;
  movement: number;
  weapon_skill: number;
  ballistic_skill: number;
  strength: number;
  toughness: number;
  wounds: number;
  initiative: number;
  attacks: number;
  leadership: number;
  armour_save: number | null;
  large: boolean;
  caster: string;
  race_id: number | null;
  race_name: string | null;
  race_label: string;
  /** Null with a formula ("2 Treasure"): the fee isn't gold. */
  hire_cost: number | null;
  hire_cost_expression: string;
  upkeep_cost: number | null;
  upkeep_cost_expression: string;
  rating: number | null;
  available_skill_types: string[];
  grade?: string;
  /** Dramatis personae only. */
  stays?: HirelingStays;
  /** Dramatis personae only: what he is paid in ("25 gc or 1 shard", a favour). */
  payment_note?: string;
  restrictions: RestrictionLink[];
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
  movement: number;
  weapon_skill: number;
  ballistic_skill: number;
  strength: number;
  toughness: number;
  wounds: number;
  initiative: number;
  attacks: number;
  leadership: number;
  armour_save: number | null;
  large: boolean;
  caster: string;
  race_id: number | null;
  race_label: string;
  hire_cost: number | null;
  hire_cost_expression: string;
  upkeep_cost: number | null;
  upkeep_cost_expression: string;
  rating: number | null;
  available_skill_types: string[];
  skill_ids: number[];
  special_ids: number[];
  spell_ids: number[];
  item_entries: { item_id: number; quantity: number }[];
  restriction_ids: { restriction_id: number; additional_note: string }[];
  stays?: HirelingStays;
  payment_note?: string;
};
