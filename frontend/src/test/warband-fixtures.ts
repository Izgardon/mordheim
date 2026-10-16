import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
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

export const makeHiredSword = (overrides: Partial<WarbandHiredSword> = {}): WarbandHiredSword => ({
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
