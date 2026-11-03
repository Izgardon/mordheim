import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";
import type { WrittenStats } from "@/features/catalogue/utils/statblock";
import type {
  AvailabilityPayload,
  Item,
  ItemAvailability,
} from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

import type { BeastKind } from "../bestiary-kinds";

export type BestiaryEntryEquipment = { item: Item; quantity: number };

/**
 * The beast's Animal item (every beast has one): what is bought, moved and traded, with its
 * setting and price rows. A beast that isn't sold keeps its prices; `available_in_shop` says
 * whether the shop lists it.
 */
export type BestiaryItem = {
  id: number;
  setting_id: number | null;
  availabilities: ItemAvailability[];
};

/**
 * A beast as the bestiary lists it (`GET bestiary/`): a mount, a pet or a creature. Without a
 * profile (`has_profile` off, most pets) the stats are stored as 0 and the save as none: the pages
 * say "No profile" rather than show them.
 */
export type BestiaryEntrySummary = CatalogueBadgeFields & {
  id: number;
  campaign_id: number | null;
  name: string;
  kind: BeastKind;
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
  has_profile: boolean;
  /** Creatures: the henchmen group it becomes gains experience. */
  gains_xp: boolean;
  /** Mounts: what the beast adds to its rider's rating. */
  rating_bonus: number | null;
  /** The shop sells its item. */
  available_in_shop: boolean;
  /** Its Animal item; null only for a beast older than items for every beast, never edited. */
  item?: BestiaryItem | null;
};

/** One beast (`GET bestiary/:id/` and every write's answer): the row and what it knows and carries. */
export type BestiaryEntry = BestiaryEntrySummary & {
  skills: Skill[];
  specials: Special[];
  spells: Spell[];
  equipment: BestiaryEntryEquipment[];
};

/** A price the beast's item is sold at, as a write sends it (a price row, with who may buy it). */
export type BestiaryAvailabilityWrite = AvailabilityPayload;

/**
 * A create or an edit. A list that is sent replaces that list; one left out stays. The item's
 * prices replace its prices when sent (they are kept, and sent, with the shop unticked). A book
 * entry's edit names the campaign, and its first edit makes the campaign's version.
 */
export type BestiaryEntryWrite = {
  campaign_id?: number;
  name: string;
  kind: BeastKind;
  description?: string;
  movement?: number | string;
  weapon_skill?: number | string;
  ballistic_skill?: number | string;
  strength?: number | string;
  toughness?: number | string;
  wounds?: number | string;
  initiative?: number | string;
  attacks?: number | string;
  leadership?: number | string;
  armour_save?: number | null;
  large?: boolean;
  caster?: string;
  has_profile?: boolean;
  gains_xp?: boolean;
  rating_bonus?: number | null;
  available_in_shop?: boolean;
  item?: { availabilities: BestiaryAvailabilityWrite[] };
  skill_ids?: number[];
  special_ids?: number[];
  spell_ids?: number[];
  item_entries?: { item_id: number; quantity?: number }[];
};
