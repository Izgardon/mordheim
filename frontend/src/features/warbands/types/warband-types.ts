// types
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";

export type Warband = {
  id: number;
  name: string;
  faction: string;
  campaign_id: number;
  user_id: number;
  backstory?: string | null;
  rating?: number;
  resources?: WarbandResource[];
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
  Spc?: boolean;
  [key: string]: boolean | undefined;
};

export type WarbandHero = {
  id: number;
  warband_id: number;
  name: string | null;
  unit_type: string | null;
  race_id: number | null;
  race_name?: string | null;
  price: number | null;
  xp: number | null;
  level_up?: boolean | null;
  deeds: string | null;
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
  created_at: string;
  updated_at: string;
  available_skills?: HeroSkills | null;
  items: Item[];
  skills: Skill[];
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
  available_skills: Record<string, boolean>;
  items: Item[];
  skills: Skill[];
};

export type WarbandLog = {
  id: number;
  warband_id: number;
  feature: string;
  entry_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};



