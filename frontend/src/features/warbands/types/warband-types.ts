// types
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";
import type { Spell } from "../../spells/types/spell-types";
import type { Special } from "../../special/types/special-types";

export type Warband = {
  id: number;
  name: string;
  faction: string;
  campaign_id: number;
  user_id: number;
  backstory?: string | null;
  wins?: number | null;
  losses?: number | null;
  rating?: number;
  resources?: WarbandResource[];
  heroes?: WarbandHero[];
  dice_color?: string | null;
  created_at: string;
  updated_at: string;
};

export type WarbandResource = {
  id: number;
  warband_id: number;
  name: string;
  amount: number;
};

export type WarbandCreatePayload = {
  name: string;
  faction: string;
};

export type WarbandUpdatePayload = {
  name: string;
  faction: string;
  dice_color?: string | null;
  backstory?: string | null;
  wins?: number | null;
  losses?: number | null;
  max_units?: number | null;
};

export type HeroStats = {
  M?: string;
  WS?: string;
  BS?: string;
  S?: string;
  T?: string;
  W?: string;
  I?: string;
  A?: string;
  Ld?: string;
  [key: string]: string | undefined;
};

export type HeroSkills = {
  C?: boolean;
  Sh?: boolean;
  A?: boolean;
  St?: boolean;
  Sp?: boolean;
  Spc?: boolean;
  [key: string]: boolean | undefined;
};

export type HeroCaster = "No" | "Wizard" | "Priest";

export type WarbandHero = {
  id: number;
  warband_id: number;
  name: string | null;
  unit_type: string | null;
  race_id: number | null;
  race_name?: string | null;
  price: number | null;
  xp: number | null;
  kills?: number | null;
  level_up?: number | null;
  deeds?: string | null;
  armour_save: string | null;
  large: boolean | null;
  caster: HeroCaster | null;
  half_rate: boolean | null;
  dead: boolean | null;
  movement: number | null;
  weapon_skill: number | null;
  ballistic_skill: number | null;
  strength: number | null;
  toughness: number | null;
  wounds: number | null;
  initiative: number | null;
  attacks: number | null;
  leadership: number | null;
  created_at: string;
  updated_at: string;
  available_skills?: HeroSkills | string[] | null;
  race?: {
    name: string;
    movement: number;
    weapon_skill: number;
    ballistic_skill: number;
    strength: number;
    toughness: number;
    wounds: number;
    initiative: number;
    attacks: number;
    leadership: number;
  };
  items: Item[];
  skills: Skill[];
  specials?: Special[];
  spells?: Spell[];
};

export type WarbandHeroPayload = {
  name: string | null;
  unit_type: string | null;
  race: number | null;
  price: number | null;
  xp: number | null;
  deeds?: string | null;
  armour_save?: string | null;
  large?: boolean | null;
  caster?: HeroCaster | null;
  half_rate?: boolean | null;
  dead?: boolean | null;
  movement?: number | null;
  weapon_skill?: number | null;
  ballistic_skill?: number | null;
  strength?: number | null;
  toughness?: number | null;
  wounds?: number | null;
  initiative?: number | null;
  attacks?: number | null;
  leadership?: number | null;
  available_skills?: HeroSkills | Record<string, boolean> | null;
  item_ids?: number[];
  skill_ids?: number[];
  special_ids?: number[];
  spell_ids?: number[];
};

export type HeroFormEntry = {
  id?: number;
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  stats: Record<string, string>;
  xp: string;
  price: string;
  armour_save: string;
  deeds: string;
  large: boolean;
  caster: HeroCaster;
  half_rate: boolean;
  available_skills: Record<string, boolean>;
  items: Item[];
  skills: Skill[];
  spells: Spell[];
  specials: Special[];
};

export type Henchman = {
  id: number;
  name: string;
  kills: number;
  dead: boolean;
  cost?: number | string;
};

export type HenchmenGroup = {
  id: number;
  warband_id: number;
  name: string | null;
  unit_type: string | null;
  race_id: number | null;
  race_name?: string | null;
  price: number | null;
  xp: number | null;
  max_size?: number | null;
  level_up?: number | null;
  deeds?: string | null;
  armour_save: string | null;
  large: boolean | null;
  half_rate: boolean | null;
  dead: boolean | null;
  movement: number | null;
  weapon_skill: number | null;
  ballistic_skill: number | null;
  strength: number | null;
  toughness: number | null;
  wounds: number | null;
  initiative: number | null;
  attacks: number | null;
  leadership: number | null;
  race?: {
    name: string;
    movement: number;
    weapon_skill: number;
    ballistic_skill: number;
    strength: number;
    toughness: number;
    wounds: number;
    initiative: number;
    attacks: number;
    leadership: number;
  };
  items: Item[];
  skills: Skill[];
  specials?: Special[];
  henchmen: Henchman[];
};

export type HenchmenGroupPayload = {
  name: string | null;
  unit_type: string | null;
  race: number | null;
  price: number | null;
  xp: number | null;
  max_size?: number | null;
  deeds?: string | null;
  armour_save?: string | null;
  large?: boolean | null;
  half_rate?: boolean | null;
  dead?: boolean | null;
  movement?: number | null;
  weapon_skill?: number | null;
  ballistic_skill?: number | null;
  strength?: number | null;
  toughness?: number | null;
  wounds?: number | null;
  initiative?: number | null;
  attacks?: number | null;
  leadership?: number | null;
  item_ids?: number[];
  skill_ids?: number[];
  special_ids?: number[];
  henchmen?: { id?: number; name: string; kills?: number; dead?: boolean; cost?: number }[];
};

export type HenchmenGroupFormEntry = {
  id?: number;
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  stats: Record<string, string>;
  xp: string;
  max_size: string;
  price: string;
  armour_save: string;
  deeds: string;
  large: boolean;
  half_rate: boolean;
  items: Item[];
  skills: Skill[];
  specials: Special[];
  henchmen: Henchman[];
};

export type WarbandLog = {
  id: number;
  warband_id: number;
  feature: string;
  entry_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type WarbandLogCreatePayload = {
  feature?: string;
  entry_type?: string;
  payload: Record<string, unknown>;
};

export type WarbandItemSummary = {
  id: number;
  name: string;
  cost?: number | null;
  quantity?: number | null;
};

export type WarbandTrade = {
  id: number;
  warband_id: number;
  action: string;
  description: string;
  price: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type WarbandTradePayload = {
  action: string;
  description: string;
  price: number;
  notes?: string;
};




