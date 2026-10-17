// types
import type { Item, Restriction } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";
import type { Spell } from "../../spells/types/spell-types";
import type { Special } from "../../special/types/special-types";

type RaceStatProfile = {
  id?: number;
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
  /** From the summary (the sheet merges it in): see `WarbandRosterCounts`. */
  unit_count?: number;
  hero_count?: number;
  max_heroes?: number;
  hired_sword_count?: number;
  max_hired_swords?: number;
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

/**
 * The server's roster counts (decision 12). `unit_count` is the warband size: heroes, living
 * henchmen and blood-pacted hired swords (warn only past `max_units`). `hero_count` and
 * `hired_sword_count` count what the hard caps count: living heroes, and living hired swords
 * without a blood pact.
 */
export type WarbandRosterCounts = {
  unit_count?: number;
  max_units?: number;
  hero_count?: number;
  max_heroes?: number;
  hired_sword_count?: number;
  max_hired_swords?: number;
};

export type WarbandUnitsSummary = WarbandRosterCounts & {
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
  trading_action?: boolean | null;
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
  no_level_ups?: boolean | null;
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
  trading_action?: boolean | null;
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
  available_skills?: HeroSkills | string[] | null;
  items?: { id: number; cost?: number | null }[];
  skill_ids?: number[];
  special_ids?: number[];
  spell_ids?: number[];
  /** Create only: skip the warband's max-heroes check (henchman promotion). */
  ignore_max_heroes?: boolean;
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
  level_up?: number | null;
  deeds?: string | null;
  /** An integer field server-side; the edit form sends the raw input string ("5"), which DRF also accepts. */
  armour_save?: number | string | null;
  large?: boolean | null;
  caster?: HeroCaster | null;
  available_skills?: HeroSkills | string[] | null;
  half_rate?: boolean | null;
  no_level_ups?: boolean | null;
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
  /** A recruit queued in this edit session (no id yet): keys its queued purchases. */
  draftKey?: string;
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  race?: RaceStatProfile | null;
  stats: Record<string, string>;
  xp: string;
  /** Pending level-ups as typed in the edit form (decision 5). */
  level_up?: string;
  /** The count the server last sent: an unchanged count is left out of the update. */
  savedLevelUp?: number;
  price: string;
  armour_save: string;
  deeds: string;
  is_leader: boolean;
  trading_action: boolean;
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
  no_level_ups: boolean;
};

/** The "Add hero" form. */
export type NewHeroForm = {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  price: string;
  xp: string;
  is_leader: boolean;
};

/** The "Add hired sword" form (a preset can fill all of it, loadout included). */
export type NewHiredSwordForm = {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  stats: Record<string, string>;
  price: string;
  upkeep_price: string;
  rating: string;
  xp: string;
  armour_save: string;
  large: boolean;
  caster: HeroCaster;
  half_rate: boolean;
  blood_pacted: boolean;
  available_skills: Record<string, boolean>;
  items: Item[];
  skills: Skill[];
  spells: Spell[];
  specials: Special[];
};

/** The "Add group" form: the group and its first henchman. */
export type NewHenchmenGroupForm = {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  price: string;
  xp: string;
  max_size: string;
  firstHenchmanName: string;
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
  no_level_ups?: boolean | null;
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
  level_up?: number | null;
  max_size?: number | null;
  deeds?: string | null;
  /** An integer field server-side; the edit form sends the raw input string ("5"), which DRF also accepts. */
  armour_save?: number | string | null;
  large?: boolean | null;
  half_rate?: boolean | null;
  no_level_ups?: boolean | null;
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
  /** Create only: notes written on each recruit trade row. */
  item_notes?: string;
  skill_ids?: number[];
  special_ids?: number[];
  henchmen?: {
    id?: number;
    name: string;
    kills?: number;
    dead?: boolean;
    /** Parsed server-side with int(float(value)); only read for new henchmen. */
    cost?: number | string;
    /** Update only, new henchmen: notes written on their recruit trade row. */
    item_notes?: string;
  }[];
};

export type HenchmenGroupFormEntry = {
  id?: number;
  /** A recruit queued in this edit session (no id yet): keys its queued purchases. */
  draftKey?: string;
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  race?: RaceStatProfile | null;
  stats: Record<string, string>;
  xp: string;
  /** Pending level-ups as typed in the edit form (decision 5). */
  level_up?: string;
  /** The count the server last sent: an unchanged count is left out of the update. */
  savedLevelUp?: number;
  max_size: string;
  price: string;
  armour_save: string;
  deeds: string;
  large: boolean;
  half_rate: boolean;
  no_level_ups: boolean;
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

export type WarbandUnitDetail = WarbandHero | WarbandHiredSword | HenchmenGroup;

export type WarbandItemTransferPayload = {
  source_type: "hero" | "hired_sword" | "henchmen_group" | "stash";
  source_id?: number | null;
  target_type: "hero" | "hired_sword" | "henchmen_group" | "stash";
  target_id?: number | null;
  item_id: number;
  quantity: number;
};

export type WarbandItemSalePayload = {
  source_type: "hero" | "hired_sword" | "henchmen_group" | "stash";
  source_id?: number | null;
  item_id: number;
  quantity: number;
  price: number;
};

export type WarbandItemMutationResponse = {
  summary: WarbandUnitsSummary;
  source: WarbandUnitDetail | WarbandItemSummary | null;
  target?: WarbandUnitDetail | WarbandItemSummary | null;
  stash_item?: WarbandItemSummary | null;
  removed_stash_item_id?: number | null;
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
