import type { Item } from "@/features/items/types/item-types";
import type { Race } from "@/features/races/types/race-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
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

export const makeHireling = (overrides: Partial<WarbandHireling> = {}): WarbandHireling => ({
  ...baseUnit,
  id: 1,
  name: "Ogre Bodyguard",
  unit_type: "Ogre",
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

export const makeSpell = (overrides: Partial<Spell> = {}): Spell => ({
  id: 1,
  name: "Fires of U'Zhul",
  type: "Lesser Magic",
  description: "",
  dc: 7,
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
export const lightArmour = makeItem({ id: 103, name: "Light Armour", type: "Armour", cost: 20 });
export const club = makeItem({ id: 104, name: "Club", cost: 3 });
export const warhammer = makeItem({ id: 105, name: "Warhammer", cost: 3 });

/** Hero: leader, wizard, trading action available, 7 XP (level 4, next level at 8). */
export const makeVeteranHero = (overrides: Partial<WarbandHero> = {}): WarbandHero => ({
  ...baseUnit,
  id: 11,
  warband_id: VETERAN_WARBAND_ID,
  name: "Aldric the Bold",
  unit_type: "Captain",
  race_id: humanRace.id,
  race_name: humanRace.name,
  race: humanProfile,
  price: 60,
  xp: 7,
  kills: 3,
  level_up: 1,
  level_up_history: [],
  deeds: "Slew the Possessed at the well.",
  is_leader: true,
  trading_action: true,
  armour_save: 5,
  large: false,
  caster: "Wizard",
  half_rate: false,
  dead: false,
  movement: 4,
  weapon_skill: 4,
  ballistic_skill: 4,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 4,
  attacks: 1,
  leadership: 8,
  available_skills: ["Combat", "Academic"],
  items: [sword, dagger, dagger, lightArmour],
  skills: [makeSkill({ id: 201, name: "Mighty Blow", type: "Combat" })],
  spells: [makeSpell({ id: 301, name: "Fires of U'Zhul", dc: 7 })],
  specials: [makeSpecial({ id: 401, name: "Leader" })],
  ...overrides,
});

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

/** Hired sword: priest with upkeep, not blood-pacted, 4 XP (level 2 on the henchmen table). */
export const makeVeteranHireling = (overrides: Partial<WarbandHireling> = {}): WarbandHireling => ({
  ...baseUnit,
  id: 31,
  warband_id: VETERAN_WARBAND_ID,
  name: "Brother Hal",
  unit_type: "Warrior Priest",
  race_id: humanRace.id,
  race_name: humanRace.name,
  race: humanProfile,
  price: 40,
  hire_cost_expression: null,
  upkeep_price: 15,
  upkeep_cost_expression: null,
  rating: 25,
  xp: 4,
  kills: 2,
  level_up: 1,
  level_up_history: [],
  deeds: "Blessed the warband before the storm.",
  armour_save: 4,
  large: false,
  caster: "Priest",
  half_rate: false,
  no_level_ups: false,
  blood_pacted: false,
  dead: false,
  movement: 4,
  weapon_skill: 4,
  ballistic_skill: 3,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 8,
  available_skills: ["Combat", "Academic"],
  items: [warhammer, lightArmour],
  skills: [makeSkill({ id: 203, name: "Resilient", type: "Strength" })],
  spells: [makeSpell({ id: 302, name: "Hammer of Sigmar", type: "Prayers of Sigmar", dc: 7 })],
  specials: [makeSpecial({ id: 403, name: "Sigmarite" })],
  ...overrides,
});
