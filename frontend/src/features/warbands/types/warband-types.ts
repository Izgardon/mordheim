// types
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";

export type Warband = {
  id: number;
  name: string;
  faction: string;
  campaign_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
};

export type WarbandCreatePayload = {
  name: string;
  faction: string;
};

export type WarbandUpdatePayload = {
  name: string;
  faction: string;
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
  race: string | null;
  stats: HeroStats | null;
  experience: number | null;
  hire_cost: number | null;
  available_skills: HeroSkills | null;
  items: Item[];
  skills: Skill[];
};

export type WarbandHeroPayload = {
  name: string | null;
  unit_type: string | null;
  race: string | null;
  stats: HeroStats | Record<string, string> | null;
  experience: number | null;
  hire_cost: number | null;
  available_skills: HeroSkills | Record<string, boolean> | null;
  item_ids?: number[];
  skill_ids?: number[];
};

export type HeroFormEntry = {
  id?: number;
  name: string;
  unit_type: string;
  race: string;
  stats: Record<string, string>;
  experience: string;
  hire_cost: string;
  available_skills: Record<string, boolean>;
  items: Item[];
  skills: Skill[];
};



