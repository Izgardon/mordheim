import type { Item } from "@/features/items/types/item-types";
import type { Race } from "@/features/races/types/race-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandItemSummary,
} from "@/features/warbands/types/warband-types";

const baseUnit = {
  warband_id: 1,
  race_id: 1,
  price: 0,
  xp: 0,
  armour_save: null,
  large: false,
  half_rate: false,
  dead: false,
  movement: 4,
  weapon_skill: 3,
  ballistic_skill: 3,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 7,
  created_at: "",
  updated_at: "",
  items: [],
  skills: [],
};

export const makeHero = (overrides: Partial<WarbandHero> = {}): WarbandHero => ({
  ...baseUnit,
  id: 1,
  name: "Captain Aldric",
  unit_type: "Captain",
  caster: "No",
  ...overrides,
});

export const makeHenchmenGroup = (overrides: Partial<HenchmenGroup> = {}): HenchmenGroup => ({
  ...baseUnit,
  id: 1,
  name: "Black Knives",
  unit_type: "Thugs",
  henchmen: [],
  ...overrides,
});

export const makeStashItem = (overrides: Partial<WarbandItemSummary> = {}): WarbandItemSummary => ({
  id: 1,
  name: "Sword",
  cost: 10,
  quantity: 1,
  ...overrides,
});

// ── Catalogue entries ──────────────────────────────────────────────────────

export const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  name: "Sword",
  type: "Melee",
  description: "",
  availabilities: [],
  cost: 10,
  ...overrides,
});

export const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: 1,
  name: "Strongman",
  type: "Strength",
  description: "",
  ...overrides,
});

export const makeSpecial = (overrides: Partial<Special> = {}): Special => ({
  id: 1,
  name: "Leader",
  type: "General",
  description: "",
  ...overrides,
});

export const humanRace: Race = {
  id: 1,
  name: "Human",
  movement: 4,
  weapon_skill: 6,
  ballistic_skill: 6,
  strength: 4,
  toughness: 4,
  wounds: 3,
  initiative: 6,
  attacks: 4,
  leadership: 9,
};

const { id: _humanRaceId, ...humanProfile } = humanRace;

// ── Realistic units, one of each kind ──────────────────────────────────────
//
// Detail-shaped (race, deeds and kills present, so expanded cards don't refetch), with a
// full loadout and XP one point below the next level threshold of each kind's default table.

export const VETERAN_WARBAND_ID = 9;

export const sword = makeItem({ id: 101, name: "Sword", cost: 10 });
export const dagger = makeItem({ id: 102, name: "Dagger", cost: 2 });
export const club = makeItem({ id: 104, name: "Club", cost: 3 });

/** Henchmen group: three living members, 4 XP (level 2, next level at 5), no spells. */
export const makeVeteranHenchmenGroup = (
  overrides: Partial<HenchmenGroup> = {}
): HenchmenGroup => ({
  ...baseUnit,
  id: 21,
  warband_id: VETERAN_WARBAND_ID,
  name: "Black Knives",
  unit_type: "Thugs",
  race_id: humanRace.id,
  race_name: humanRace.name,
  race: humanProfile,
  price: 25,
  xp: 4,
  max_size: 5,
  level_up: 1,
  level_up_history: [],
  deeds: "Held the bridge for a whole turn.",
  armour_save: 6,
  large: false,
  half_rate: false,
  no_level_ups: false,
  dead: false,
  movement: 4,
  weapon_skill: 3,
  ballistic_skill: 3,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 7,
  items: [club, club, club, dagger, dagger, dagger],
  skills: [makeSkill({ id: 202, name: "Resilient", type: "Strength" })],
  specials: [makeSpecial({ id: 402, name: "Animosity" })],
  henchmen: [
    { id: 61, name: "Blade One", kills: 2, dead: false },
    { id: 62, name: "Blade Two", kills: 0, dead: false },
    { id: 63, name: "Blade Three", kills: 1, dead: false },
  ],
  ...overrides,
});
