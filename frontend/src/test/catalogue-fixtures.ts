/**
 * The catalogue as the list endpoints return it for campaign 1 (`?campaign_id=1`): book rows
 * (`campaign_id: null`) and the campaign's own rows, already merged by the server (a campaign
 * row hides every book row of its name, BUG-18). Pages read these through `useCatalogue`.
 */
import { blankFee } from "@/features/hirelings/fees";
import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";
import type { HirelingProfile } from "@/features/hirelings/types/hireling-catalogue-types";
import type { Item, ItemAvailability } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Spell } from "@/features/spells/types/spell-types";
import { CAMPAIGN_ID } from "./campaign-fixtures";

export const availability = (overrides: Partial<ItemAvailability> = {}): ItemAvailability => ({
  id: 11,
  label: "",
  cost: 5,
  dice: null,
  dice_multiplier: null,
  cost_note: "",
  rarity: null,
  for_everyone: true,
  warbands: [],
  note: "",
  ...overrides,
});

export const item = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  campaign_id: null,
  name: "Axe",
  type: "Weapon",
  subtype: "Melee",
  variant: "",
  setting_id: null,
  single_use: false,
  flavour: "",
  strength: "As user",
  range: "Close combat",
  save: null,
  statblock: null,
  source: "",
  link_url: "",
  tags: [],
  notes: "",
  rules: [],
  availabilities: [availability()],
  generated_effect_key: null,
  bestiary_entry: null,
  ...overrides,
});
export const sword = item({
  id: 2,
  name: "Sword",
  rules: [
    {
      id: 501,
      rule_id: 51,
      shared: true,
      name: "Parry",
      summary: "Parries a blow",
      text: "Parries the first blow.",
      table: [],
    },
  ],
  availabilities: [availability({ id: 12, cost: 10 })],
});

export const skill = (overrides: Partial<Skill> = {}): Skill => ({
  id: 205,
  campaign_id: null,
  name: "Strike to Injure",
  type: "Combat",
  description: "Add +1 to injury rolls.",
  ...overrides,
});

export const spell = (overrides: Partial<Spell> = {}): Spell => ({
  id: 301,
  campaign_id: null,
  name: "Fires of U'Zhul",
  type: "Lesser Magic",
  description: "A ball of fire.",
  dc: 7,
  roll: 1,
  ...overrides,
});

/** A beast's Animal item, sold for `cost` gc at `rarity`. */
export const beastItem = (id: number, cost: number, rarity: number, availabilityId = id + 100) => ({
  id,
  setting_id: null,
  availabilities: [availability({ id: availabilityId, cost, rarity })],
});

/** The book Warhound, a creature sold for 15 gc (its item is the Wargear's Warhound). */
export const bestiaryEntry = (
  overrides: Partial<BestiaryEntrySummary> = {}
): BestiaryEntrySummary => ({
  id: 5,
  campaign_id: null,
  name: "Warhound",
  kind: "creature",
  description: "A hound bred for war.",
  movement: 6,
  weapon_skill: 4,
  ballistic_skill: 0,
  strength: 4,
  toughness: 3,
  wounds: 1,
  initiative: 4,
  attacks: 1,
  leadership: 5,
  armour_save: null,
  large: false,
  caster: "No",
  has_profile: true,
  gains_xp: false,
  rating_bonus: null,
  available_in_shop: true,
  item: { id: 260, setting_id: null, availabilities: [availability({ id: 44, cost: 15 })] },
  replaces: null,
  archived_at: null,
  updated_by: null,
  updated_at: null,
  book: null,
  ...overrides,
});
/** A book mount: 80 gc, Rare 11, and +5 to its rider's rating. */
export const warhorse = bestiaryEntry({
  id: 6,
  name: "Warhorse",
  kind: "mount",
  description: "A knight's charger.",
  movement: 8,
  weapon_skill: 3,
  strength: 3,
  rating_bonus: 5,
  item: beastItem(230, 80, 11, 242),
});

/** A hired sword or dramatis persona as the catalogue lists it (the book's Ogre Bodyguard). */
export const hiredSword = (overrides: Partial<HirelingProfile> = {}): HirelingProfile => ({
  id: 17,
  campaign_id: null,
  setting_id: null,
  name: "Ogre Bodyguard",
  description: "Big and loyal while paid.",
  movement: 6,
  weapon_skill: 3,
  ballistic_skill: 2,
  strength: 4,
  toughness: 4,
  wounds: 3,
  initiative: 3,
  attacks: 2,
  leadership: 7,
  armour_save: null,
  large: true,
  caster: "No",
  race_id: 4,
  race_name: "Ogre",
  race_label: "Ogre",
  hire_fee: { ...blankFee(), gold: 80 },
  upkeep_fee: { ...blankFee(), gold: 30 },
  rating: 25,
  available_skill_types: ["Combat", "Strength"],
  grade: "1a",
  for_everyone: true,
  warbands: [],
  hire_note: "",
  replaces: null,
  archived_at: null,
  updated_by: null,
  updated_at: null,
  book: null,
  ...overrides,
});
/** The campaign's own hired sword. */
export const pitFighter = hiredSword({
  id: 40,
  campaign_id: CAMPAIGN_ID,
  name: "Pit Fighter",
  description: "Fights for coin.",
  large: false,
  movement: 4,
  race_id: 1,
  race_name: "Human",
  race_label: "Human",
  hire_fee: { ...blankFee(), gold: 35 },
  upkeep_fee: { ...blankFee(), gold: 15 },
  rating: 12,
  available_skill_types: ["Combat"],
  grade: "",
});
export const HIRED_SWORDS: HirelingProfile[] = [pitFighter, hiredSword()];

/** A promise a test settles by hand, for answers that must arrive in a chosen order. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
