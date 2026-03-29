// types
import type { Item, Restriction } from "../../items/types/item-types";
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
  warband_link?: string | null;
  wins?: number | null;
  losses?: number | null;
  rating?: number;
  gold?: number;
  max_units?: number | null;
  resources?: WarbandResource[];
  heroes?: WarbandHero[];
  hired_swords?: WarbandHiredSword[];
  henchmen_groups?: HenchmenGroup[];
  restrictions?: Restriction[];
  dice_color?: string | null;
  show_loadout_on_mobile?: boolean;
  created_at: string;
  updated_at: string;
};

export type WarbandUnitsSummary = {
  resources?: WarbandResource[];
  rating?: number;
  gold?: number;
  heroes?: WarbandHero[];
  hired_swords?: WarbandHiredSword[];
  henchmen_groups?: HenchmenGroup[];
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
  restriction_ids?: number[];
  max_units?: number;
};

export type WarbandUpdatePayload = {
  name: string;
  faction: string;
  dice_color?: string | null;
  backstory?: string | null;
  wins?: number | null;
  losses?: number | null;
  max_units?: number | null;
  show_loadout_on_mobile?: boolean;
  warband_link?: string | null;
};

export type LevelUpHistoryEntry = {
  code: string;
  label: string;
  timestamp: string;
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
  level_up_history?: LevelUpHistoryEntry[];
  deeds?: string | null;
  is_leader?: boolean | null;
  armour_save: number | null;
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

export type WarbandHiredSword = {
  id: number;
  warband_id: number;
  name: string | null;
  unit_type: string | null;
  race_id: number | null;
  race_name?: string | null;
  price: number | null;
  hire_cost_expression?: string | null;
  upkeep_price?: number | null;
  upkeep_cost_expression?: string | null;
  rating?: number | null;
  xp: number | null;
  kills?: number | null;
  level_up?: number | null;
  level_up_history?: LevelUpHistoryEntry[];
  deeds?: string | null;
  armour_save: number | null;
  large: boolean | null;
  caster: HeroCaster | null;
  half_rate: boolean | null;
  blood_pacted?: boolean | null;
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
  level_up?: number | null;
  deeds?: string | null;
  is_leader?: boolean | null;
  armour_save?: number | null;
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
  items?: { id: number; cost?: number | null }[];
  skill_ids?: number[];
  special_ids?: number[];
  spell_ids?: number[];
};

export type WarbandHiredSwordPayload = {
  name: string | null;
  unit_type: string | null;
  race: number | null;
  price: number | null;
  hire_cost_expression?: string;
  upkeep_price?: number | null;
  upkeep_cost_expression?: string;
  rating?: number | null;
  xp: number | null;
  deeds?: string | null;
  armour_save?: number | null;
  large?: boolean | null;
  caster?: HeroCaster | null;
  available_skills?: HeroSkills | Record<string, boolean> | null;
  half_rate?: boolean | null;
  blood_pacted?: boolean | null;
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
  items?: { id: number; cost?: number | null }[];
  skill_ids?: number[];
  special_ids?: number[];
  spell_ids?: number[];
  ignore_max_heroes?: boolean;
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
  is_leader: boolean;
  large: boolean;
  caster: HeroCaster;
  half_rate: boolean;
  available_skills: Record<string, boolean>;
  items: Item[];
  skills: Skill[];
  spells: Spell[];
  specials: Special[];
};

export type HiredSwordFormEntry = HeroFormEntry & {
  upkeep_price: string;
  rating: string;
  blood_pacted: boolean;
};

export type HenchmanItemChoice = {
  itemId: number;
  action: "buy" | "stash" | "ignore";
  cost?: number;
};

export type Henchman = {
  id: number;
  name: string;
  kills: number;
  dead: boolean;
  cost?: number | string;
  itemChoices?: HenchmanItemChoice[];
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
  level_up_history?: LevelUpHistoryEntry[];
  deeds?: string | null;
  armour_save: number | null;
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
  armour_save?: number | null;
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
  items?: { id: number; cost?: number | null }[];
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
  parent_id: number | null;
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

export type NamedKillHistoryEntry = {
  victim_name: string;
  victim_warband_name: string;
  scenario_name: string;
};

export type NamedKillHistory = {
  total_kills: number;
  named_kills_count: number;
  named_kills: NamedKillHistoryEntry[];
};

export type WarbandItemSummary = {
  id: number;
  name: string;
  cost?: number | null;
  quantity?: number | null;
};

export type WarbandTradeChild = {
  id: number;
  action: string;
  description: string;
  price: number;
  notes: string;
  created_at: string;
};

export type WarbandTrade = {
  id: number;
  warband_id: number;
  parent_id: number | null;
  action: string;
  description: string;
  price: number;
  notes: string;
  children: WarbandTradeChild[];
  created_at: string;
  updated_at: string;
};

export type WarbandTradePayload = {
  action: string;
  description: string;
  price: number;
  notes?: string;
  parent_id?: number | null;
};




