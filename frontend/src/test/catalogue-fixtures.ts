/**
 * The catalogue as the list endpoints return it for campaign 1 (`?campaign_id=1`): book rows
 * (`campaign_id: null`) and the campaign's own rows, already merged by the server (a campaign
 * row hides every book row of its name, BUG-18). Pages read these through `useCatalogue`.
 */
import type {
  BestiaryEntry,
  BestiaryEntrySummary,
  HiredSwordProfile,
  HiredSwordProfileSummary,
} from "@/features/bestiary/types/bestiary-types";
import type { Item, ItemAvailability, ItemProperty } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";
import { CAMPAIGN_ID, OWNER } from "./campaign-fixtures";
import { fakeApi } from "./fake-api";

/** `"GET /<list>/?campaign_id=1"`: each catalogue list as `useCatalogue` requests it. */
export const LIST = {
  items: `GET /items/?campaign_id=${CAMPAIGN_ID}`,
  properties: `GET /item-properties/?campaign_id=${CAMPAIGN_ID}`,
  skills: `GET /skills/?campaign_id=${CAMPAIGN_ID}`,
  spells: `GET /spells/?campaign_id=${CAMPAIGN_ID}`,
  specials: `GET /special/?campaign_id=${CAMPAIGN_ID}`,
  bestiary: `GET /bestiary/?campaign_id=${CAMPAIGN_ID}`,
  hiredSwords: `GET /hired-swords/?campaign_id=${CAMPAIGN_ID}`,
} as const;

/** Your warband's bestiary favourites (the Bestiary page reads them for the stars). */
export const FAVOURITES = `GET /warbands/${OWNER.warband!.id}/bestiary-favourites/`;

export const availability = (overrides: Partial<ItemAvailability> = {}): ItemAvailability => ({
  id: 11,
  cost: 5,
  rarity: 2,
  restrictions: [],
  variable_cost: null,
  ...overrides,
});

export const restricted = (id: number, restriction: string) => ({
  restriction: { id, type: "Warband", restriction },
  additional_note: "",
});

export const item = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  campaign_id: null,
  name: "Axe",
  type: "Weapon",
  subtype: "Melee",
  grade: "",
  single_use: false,
  description: "",
  strength: "As user",
  range: "Close combat",
  save: null,
  statblock: null,
  properties: [],
  availabilities: [availability()],
  generated_effect_key: null,
  bestiary_entry: null,
  ...overrides,
});

/** The campaign's "Axe" at 25 gc: the list returns it in place of the book Axe (5 gc). */
export const campaignAxe = item({
  id: 231,
  campaign_id: CAMPAIGN_ID,
  availabilities: [availability({ id: 41, cost: 25 })],
});
export const rustyCleaver = item({
  id: 240,
  campaign_id: CAMPAIGN_ID,
  name: "Rusty Cleaver",
  availabilities: [availability({ id: 42, cost: 7 })],
});
export const sword = item({
  id: 2,
  name: "Sword",
  properties: [{ id: 501, name: "Parry", type: "Weapon" }],
  availabilities: [availability({ id: 12, cost: 10 })],
});
/** One book item, two availabilities: two rows on the Wargear page (CAT-UX-03). */
export const blowpipe = item({
  id: 61,
  name: "Blowpipe",
  subtype: "Ranged",
  range: "16",
  availabilities: [
    availability({ id: 71, cost: 25, rarity: 2, restrictions: [restricted(81, "Forest Goblins")] }),
    availability({
      id: 72,
      cost: 25,
      rarity: 7,
      restrictions: [restricted(82, "Lizardmen"), restricted(83, "Skaven")],
    }),
  ],
});
/** A Half Price Armour clone: a campaign row that changes with its rule only (BUG-51). */
export const halfPriceArmour = item({
  id: 250,
  campaign_id: CAMPAIGN_ID,
  name: "Heavy Armour",
  type: "Armour",
  subtype: "Armour",
  strength: null,
  range: null,
  save: "5+",
  generated_effect_key: "half_price_armour",
  availabilities: [availability({ id: 43, cost: 25 })],
});
/** A book Animal that links its bestiary entry (the row's "Bestiary" button). */
export const warhoundItem = item({
  id: 260,
  name: "Warhound",
  type: "Animal",
  subtype: "Attack",
  strength: null,
  range: null,
  availabilities: [availability({ id: 44, cost: 15, rarity: 2 })],
  bestiary_entry: {
    id: 5,
    name: "Warhound",
    type: "Attack",
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
    specials: [],
  },
});

export const ITEMS: Item[] = [
  campaignAxe,
  rustyCleaver,
  halfPriceArmour,
  sword,
  blowpipe,
  warhoundItem,
];

export const PROPERTIES: ItemProperty[] = [
  { id: 501, campaign_id: null, name: "Parry", type: "Weapon", description: "Parries a blow." },
];

export const skill = (overrides: Partial<Skill> = {}): Skill => ({
  id: 205,
  campaign_id: null,
  name: "Strike to Injure",
  type: "Combat",
  description: "Add +1 to injury rolls.",
  ...overrides,
});
export const quickHands = skill({
  id: 900,
  campaign_id: CAMPAIGN_ID,
  name: "Quick Hands",
  type: "Speed",
  description: "Steals a drink before anyone notices.",
});
export const SKILLS: Skill[] = [quickHands, skill()];

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
export const gutterHex = spell({
  id: 950,
  campaign_id: CAMPAIGN_ID,
  name: "Gutter Hex",
  description: "The cobbles curse your enemy.",
  dc: 8,
  roll: 2,
});
export const SPELLS: Spell[] = [gutterHex, spell()];

export const SPECIALS: Special[] = [
  { id: 401, campaign_id: null, name: "Leader", type: "Trait", description: "Leads." },
];

export const bestiaryEntry = (
  overrides: Partial<BestiaryEntrySummary> = {}
): BestiaryEntrySummary => ({
  id: 5,
  campaign_id: null,
  name: "Warhound",
  type: "Attack",
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
  ...overrides,
});
export const sewerRat = bestiaryEntry({
  id: 90,
  campaign_id: CAMPAIGN_ID,
  name: "Sewer Rat",
  description: "Bites ankles.",
});
export const warhorse = bestiaryEntry({ id: 6, name: "Warhorse", type: "Mount" });
/** The bestiary list also returns every hired sword's entry; the page drops them (PERF-47). */
export const ogreEntry = bestiaryEntry({
  id: 31,
  name: "Ogre Bodyguard",
  type: "Hired Sword",
  description: "Big and loyal while paid.",
  large: true,
});
export const pitFighterEntry = bestiaryEntry({
  id: 91,
  campaign_id: CAMPAIGN_ID,
  name: "Pit Fighter",
  type: "Hired Sword",
  description: "Fights for coin.",
});
export const BESTIARY: BestiaryEntrySummary[] = [
  sewerRat,
  pitFighterEntry,
  bestiaryEntry(),
  warhorse,
  ogreEntry,
];

/** `GET bestiary/:id/`: the summary with its links. */
export const bestiaryDetail = (
  entry: BestiaryEntrySummary,
  overrides: Partial<BestiaryEntry> = {}
): BestiaryEntry => ({
  ...entry,
  skills: [],
  specials: [],
  spells: [],
  equipment: [],
  ...overrides,
});

export const hiredSword = (
  overrides: Partial<HiredSwordProfileSummary> = {}
): HiredSwordProfileSummary => ({
  id: 17,
  campaign_id: null,
  race: "Ogre",
  hire_cost: 80,
  hire_cost_expression: "",
  upkeep_cost: 30,
  upkeep_cost_expression: "",
  rating: 25,
  available_skill_types: ["Combat", "Strength"],
  restrictions: [],
  bestiary_entry: ogreEntry,
  ...overrides,
});
export const pitFighter = hiredSword({
  id: 40,
  campaign_id: CAMPAIGN_ID,
  race: "Human",
  hire_cost: 35,
  upkeep_cost: 15,
  rating: 12,
  available_skill_types: ["Combat"],
  bestiary_entry: pitFighterEntry,
});
export const HIRED_SWORDS: HiredSwordProfileSummary[] = [pitFighter, hiredSword()];

/** `GET hired-swords/:id/`: the profile with its entry's links. */
export const hiredSwordDetail = (
  profile: HiredSwordProfileSummary,
  entry: Partial<BestiaryEntry> = {}
): HiredSwordProfile => ({
  ...profile,
  bestiary_entry: bestiaryDetail(profile.bestiary_entry, entry),
});

/** Answers every catalogue list (and your favourites) with the fixtures above. */
export function routeCatalogue() {
  fakeApi.on(LIST.items, ITEMS);
  fakeApi.on(LIST.properties, PROPERTIES);
  fakeApi.on(LIST.skills, SKILLS);
  fakeApi.on(LIST.spells, SPELLS);
  fakeApi.on(LIST.specials, SPECIALS);
  fakeApi.on(LIST.bestiary, BESTIARY);
  fakeApi.on(LIST.hiredSwords, HIRED_SWORDS);
  fakeApi.on(FAVOURITES, []);
}

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
