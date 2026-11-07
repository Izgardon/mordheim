// types
import type { Item, SalePriceBasis } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";
import type { Spell } from "../../spells/types/spell-types";
import type { Special } from "../../special/types/special-types";
import type { Fee } from "../../hirelings/fees";
import type { BeastKind } from "../../bestiary/bestiary-kinds";
import type { WrittenStats } from "../../catalogue/utils/statblock";
import type { CreatureGroupFields, GroupMountFields, UnitCompanionFields } from "./companion-types";

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

/** A setting as a warband type or a catalogue row names it: its grade is the setting's. */
export type SettingBrief = { id: number; slug: string; name: string; grade: string };

/**
 * A warband type (grading phase 1): the book's (`campaign_id` null, in one setting) or a campaign's
 * own (no setting, always in play there). `groups`: the races and sides it belongs to.
 */
export type WarbandTypeBrief = {
  id: number;
  name: string;
  slug: string;
  campaign_id: number | null;
  setting: SettingBrief | null;
  source: string;
  link_url: string;
  groups: string[];
};

/** A row of the warband type picker: the brief, its race and grades, and whether it is in play. */
export type WarbandTypeRow = WarbandTypeBrief & {
  race: string;
  source_code: string;
  broheim_grade: string;
  mordheimer_grade: string;
  in_play: boolean | null;
};

export type Warband = {
  id: number;
  name: string;
  /** What it is; null only for a warband made outside the API. */
  warband_type: WarbandTypeBrief | null;
  /** The types it also counts as (custom warbands, house rules). */
  counts_as: WarbandTypeBrief[];
  campaign_id: number;
  user_id: number;
  backstory?: string | null;
  warband_link?: string | null;
  wins?: number | null;
  losses?: number | null;
  rating?: number;
  /** The mounts' part of `rating`, from the summary. */
  mounts_rating?: number;
  gold?: number;
  max_units?: number | null;
  /** Its template's variant (the templates plan, phase 2): its type's preset, else picked when raising. */
  template_variant?: string;
  /** From the summary (the sheet merges it in): see `WarbandRosterCounts`. */
  unit_count?: number;
  hero_count?: number;
  max_heroes?: number;
  hireling_count?: number;
  max_hired_swords?: number;
  resources?: WarbandResource[];
  heroes?: WarbandHero[];
  hirelings?: WarbandHireling[];
  henchmen_groups?: HenchmenGroup[];
  dice_color?: string | null;
  show_loadout_on_mobile?: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * The server's roster counts (decision 12). `unit_count` is the warband size: heroes, living
 * henchmen and blood-pacted hired swords (warn only past `max_units`). `hero_count` and
 * `hireling_count` count what the hard caps count: living heroes, and living hired swords
 * without a blood pact.
 */
export type WarbandRosterCounts = {
  unit_count?: number;
  max_units?: number;
  hero_count?: number;
  max_heroes?: number;
  hireling_count?: number;
  max_hired_swords?: number;
};

export type WarbandUnitsSummary = WarbandRosterCounts & {
  resources?: WarbandResource[];
  rating?: number;
  /** The mounts' part of `rating`, from the summary. */
  mounts_rating?: number;
  gold?: number;
  heroes?: WarbandHero[];
  hirelings?: WarbandHireling[];
  henchmen_groups?: HenchmenGroup[];
};

export type WarbandResource = {
  id: number;
  warband_id: number;
  name: string;
  amount: number;
  /**
   * The campaign's default resource (Wyrdstone unless the campaign renames it): every warband has
   * it, first; it is never deleted, and only the campaign's settings rename it.
   */
  is_default: boolean;
  /**
   * Campaign points: every warband holds them while the campaign has them on (the server leaves
   * them out while off), next after the default; never renamed or deleted.
   */
  is_campaign_points?: boolean;
};

/** One of the warband's own rules: its title is the pill, its description what the pill opens. */
export type WarbandRule = {
  id: number;
  title: string;
  description: string;
};

export type WarbandRulePayload = { title: string; description: string };

export type WarbandCreatePayload = {
  name: string;
  warband_type_id: number;
  counts_as_ids?: number[];
  warband_link?: string | null;
  max_units?: number;
  /** For a type whose template presets no variant. */
  template_variant?: string;
};

export type WarbandUpdatePayload = {
  name: string;
  warband_type_id: number;
  /** Replaces what it counts as. */
  counts_as_ids: number[];
  dice_color?: string | null;
  backstory?: string | null;
  wins?: number | null;
  losses?: number | null;
  max_units?: number | null;
  show_loadout_on_mobile?: boolean;
  warband_link?: string | null;
  template_variant?: string;
};

export type LevelUpHistoryEntry = {
  code: string;
  label: string;
  timestamp: string;
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

/**
 * How many more of the warband's battles a unit misses, and why (0 and "" while it fights). Edit
 * mode sets them; each battle the warband finalises counts one off, and at 0 the unit is back.
 * Heroes, hired swords and henchmen groups carry them.
 */
export type MissingGamesFields = {
  missing_games?: number;
  missing_reason?: string;
};

/**
 * Skills, spells and specials an advance gave that are picked later from the card ("1 skill to
 * choose"): heroes and hired swords. A pick (or the Edit form) sets the count with the unit's save.
 */
export type PendingPickFields = {
  pending_skills?: number;
  pending_spells?: number;
  pending_specials?: number;
};

export type WarbandHero = UnitCompanionFields &
  PendingPickFields & {
    id: number;
    warband_id: number;
    /** The template fighter he was recruited as ("champion"); blank: typed by hand. */
    fighter_key?: string;
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
    /** How many more battles it misses, and why (`MissingGamesFields`). */
    missing_games?: number;
    missing_reason?: string;
    movement: number | null;
    weapon_skill: number | null;
    ballistic_skill: number | null;
    strength: number | null;
    toughness: number | null;
    wounds: number | null;
    initiative: number | null;
    attacks: number | null;
    leadership: number | null;
    /** Stats written as the books print them ("1(2)", "D6"), by field; each number is the one its text starts with, or null. */
    written_stats?: WrittenStats;
    created_at: string;
    updated_at: string;
    available_skills?: HeroSkills | string[] | null;
    /** The spell lores he casts from, by name (copied from his template fighter). */
    available_spell_types?: string[];
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

/** What a hireling is: a hired sword, or a dramatis persona ("hireling" is the code's word only). */
export type HirelingKind = "hired_sword" | "dramatis_persona";
/** The serious-injury table a hireling rolls on: a henchman's D6, or the campaign's hero table. */
export type HirelingInjuryTable = "henchman" | "hero";
/** How long a hireling stays: until dismissed, or for one battle (a dramatis persona's). */
export type HirelingStays = "always" | "one_battle";

/** The hireling fields that say what it is, how it is hurt, how long it stays and its pay. */
export type HirelingTerms = {
  kind: HirelingKind;
  injury_table: HirelingInjuryTable;
  stays: HirelingStays;
  payment_note: string;
};

export type WarbandHireling = UnitCompanionFields &
  PendingPickFields & {
    id: number;
    warband_id: number;
    name: string | null;
    unit_type: string | null;
    /** Older payloads leave these out: a hired sword on the henchman table who stays. */
    kind?: HirelingKind;
    injury_table?: HirelingInjuryTable;
    stays?: HirelingStays;
    payment_note?: string;
    race_id: number | null;
    race_name?: string | null;
    price: number | null;
    /** The fee he was hired for and the upkeep he is kept for (structured fees). */
    hire_fee?: Fee;
    upkeep_fee?: Fee;
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
    /** How many more battles it misses, and why (`MissingGamesFields`). */
    missing_games?: number;
    missing_reason?: string;
    movement: number | null;
    weapon_skill: number | null;
    ballistic_skill: number | null;
    strength: number | null;
    toughness: number | null;
    wounds: number | null;
    initiative: number | null;
    attacks: number | null;
    leadership: number | null;
    /** Stats written as the books print them ("1(2)", "D6"), by field; each number is the one its text starts with, or null. */
    written_stats?: WrittenStats;
    created_at: string;
    updated_at: string;
    available_skills?: HeroSkills | string[] | null;
    /** The spell lores he casts from, by name (copied from his template fighter). */
    available_spell_types?: string[];
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
  /** Updates only: XP added (negative: taken away) by hand; a half-rate unit gains half. */
  xp_change?: number;
  level_up?: number | null;
  deeds?: string | null;
  is_leader?: boolean | null;
  trading_action?: boolean | null;
  /** A save the client couldn't read is sent as typed, for the server's message (decision 11). */
  armour_save?: number | string | null;
  large?: boolean | null;
  caster?: HeroCaster | null;
  half_rate?: boolean | null;
  dead?: boolean | null;
  movement?: number | string | null;
  weapon_skill?: number | string | null;
  ballistic_skill?: number | string | null;
  strength?: number | string | null;
  toughness?: number | string | null;
  wounds?: number | string | null;
  initiative?: number | string | null;
  attacks?: number | string | null;
  leadership?: number | string | null;
  available_skills?: HeroSkills | string[] | null;
  /** The spell lores he casts from, by name (copied from his template fighter). */
  available_spell_types?: string[];
  items?: { id: number; cost?: number | null }[];
  skill_ids?: number[];
  special_ids?: number[];
  spell_ids?: number[];
  /** Create only: skip the warband's max-heroes check (henchman promotion). */
  ignore_max_heroes?: boolean;
};

export type WarbandHirelingPayload = {
  name: string | null;
  unit_type: string | null;
  race: number | null;
  price: number | null;
  hire_fee?: Fee;
  upkeep_fee?: Fee;
  rating?: number | null;
  xp: number | null;
  /** Updates only: XP added (negative: taken away) by hand; a half-rate unit gains half. */
  xp_change?: number;
  level_up?: number | null;
  deeds?: string | null;
  /** An integer field server-side; the edit form sends the raw input string ("5"), which DRF also accepts. */
  armour_save?: number | string | null;
  large?: boolean | null;
  caster?: HeroCaster | null;
  available_skills?: HeroSkills | string[] | null;
  /** The spell lores he casts from, by name (copied from his template fighter). */
  available_spell_types?: string[];
  half_rate?: boolean | null;
  no_level_ups?: boolean | null;
  blood_pacted?: boolean | null;
  kind?: HirelingKind;
  injury_table?: HirelingInjuryTable;
  stays?: HirelingStays;
  payment_note?: string;
  dead?: boolean | null;
  movement?: number | string | null;
  weapon_skill?: number | string | null;
  ballistic_skill?: number | string | null;
  strength?: number | string | null;
  toughness?: number | string | null;
  wounds?: number | string | null;
  initiative?: number | string | null;
  attacks?: number | string | null;
  leadership?: number | string | null;
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
  /** A saved unit's missing games and why, as typed (a queued recruit has none). */
  missing_games?: string;
  missing_reason?: string;
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

export type HirelingFormEntry = HeroFormEntry &
  HirelingTerms & {
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

/** The "Add hired sword" form: a hireling typed by hand (Hire copies one from the catalogue). */
export type NewHirelingForm = HirelingTerms & {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  stats: Record<string, string>;
  price: string;
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

/** Why a member lacks a loadout row: his horse died, he used it, his kit went to the stash, he joined without it. */
export type GapReason = "short" | "lost" | "used" | "kit_taken";

/** A loadout row a member lacks (henchmen loadouts): `left` when the player chose to leave it so. */
export type HenchmanGap = {
  id: number;
  row_id: number;
  item_id: number;
  reason: GapReason;
  left: boolean;
};

export type Henchman = {
  id: number;
  name: string;
  kills: number;
  dead: boolean;
  cost?: number | string;
  /** The loadout rows he lacks. */
  gaps?: HenchmanGap[];
};

export type HenchmenGroup = UnitCompanionFields &
  CreatureGroupFields &
  GroupMountFields & {
    id: number;
    warband_id: number;
    name: string | null;
    unit_type: string | null;
    race_id: number | null;
    race_name?: string | null;
    price: number | null;
    /** What one more member costs, worked out by the server (decision 7, with the loadout). */
    hire_cost?: number;
    /** One member's loadout (each row's cost), and the copies the group holds at their costs. */
    loadout_each?: number;
    loadout_total?: number;
    xp: number | null;
    max_size?: number | null;
    level_up?: number | null;
    level_up_history?: LevelUpHistoryEntry[];
    deeds?: string | null;
    armour_save: number | null;
    large: boolean | null;
    half_rate: boolean | null;
    no_level_ups?: boolean | null;
    /** False: Lad's got talent warns ("Zombies can't be promoted in their rules."). */
    promotable?: boolean;
    /** The template fighter it was recruited as; blank: typed by hand. */
    fighter_key?: string;
    dead: boolean | null;
    /** How many more battles the group misses, and why (`MissingGamesFields`). */
    missing_games?: number;
    missing_reason?: string;
    movement: number | null;
    weapon_skill: number | null;
    ballistic_skill: number | null;
    strength: number | null;
    toughness: number | null;
    wounds: number | null;
    initiative: number | null;
    attacks: number | null;
    leadership: number | null;
    /** Stats written as the books print them ("1(2)", "D6"), by field; each number is the one its text starts with, or null. */
    written_stats?: WrittenStats;
    /** The group's version: a roster Save sends it back and is refused if it moved (409). */
    updated_at?: string;
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
  /** Updates only: XP added (negative: taken away) by hand; a half-rate unit gains half. */
  xp_change?: number;
  level_up?: number | null;
  max_size?: number | null;
  deeds?: string | null;
  /** An integer field server-side; the edit form sends the raw input string ("5"), which DRF also accepts. */
  armour_save?: number | string | null;
  large?: boolean | null;
  half_rate?: boolean | null;
  no_level_ups?: boolean | null;
  promotable?: boolean;
  dead?: boolean | null;
  movement?: number | string | null;
  weapon_skill?: number | string | null;
  ballistic_skill?: number | string | null;
  strength?: number | string | null;
  toughness?: number | string | null;
  wounds?: number | string | null;
  initiative?: number | string | null;
  attacks?: number | string | null;
  leadership?: number | string | null;
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
    /** Update only, a living member: he leaves, his share of the loadout to the stash or with him. */
    dismiss?: "stash" | "leaves";
    /** Update only, new henchmen: loadout rows taken from the stash for him, or that he joins without. */
    from_stash?: number[];
    without?: number[];
  }[];
};

export type HenchmenGroupFormEntry = {
  id?: number;
  /** A recruit queued in this edit session (no id yet): keys its queued purchases. */
  draftKey?: string;
  /** Recruited from a creature: it has no race and unnamed members by design (read only). */
  source_beast_id?: number | null;
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
  /** A saved unit's missing games and why, as typed (a queued recruit has none). */
  missing_games?: string;
  missing_reason?: string;
  max_size: string;
  /** The server's cost of one more member (read only; decision 7)... */
  hire_cost?: number;
  /** ...for this price, XP and items (`hireCostKey`); an edit to them makes it stale. */
  hireCostFor?: string;
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

/** One kill a unit scored (`kill-history/`, from the server's kill table): newest first. */
export type UnitKill = {
  id: number;
  /** His name, else "A Youngblood", else "Someone". */
  victim: string;
  victim_kind: "hero" | "henchman" | "hireling" | "temporary" | "creature" | "someone_else";
  victim_warband: string | null;
  battle_id: number;
  scenario: string;
  /** When the battle ended (ISO). */
  date: string;
  /** Null for a kill logged after the fight. */
  round: number | null;
  phase: "fight" | "after";
  how: "melee" | "shooting" | "magic" | "other" | null;
  /** Which model scored it, for a henchmen group; null otherwise. */
  by: string | null;
};

/** A unit's kills: its kill counter and the kills of its campaign's ended battles. */
export type UnitKillHistory = {
  total_kills: number;
  kills: UnitKill[];
};

/** How many stash copies of an item have one cost (BUG-117); null: copies of unknown cost. */
export type StashCost = { cost: number | null; quantity: number };

/**
 * A stash entry: one per item. `cost` is the cost of the copies that leave first, and `costs`
 * lists each cost's count in the order copies leave.
 */
export type WarbandItemSummary = {
  id: number;
  name: string;
  cost?: number | null;
  quantity?: number | null;
  costs?: StashCost[];
  /** One copy's suggested sale price (decision 3; null: none known). */
  suggested_sale_price?: number | null;
  /** What Buy again charges: the campaign's current price, house rule included (null: unknown). */
  current_price?: number | null;
  sale_price_basis?: SalePriceBasis | null;
  /** An Animal item's beast kind (null for any other item): a creature's row offers Recruit. */
  beast_kind?: BeastKind | null;
};

export type WarbandUnitDetail = WarbandHero | WarbandHireling | HenchmenGroup;

export type WarbandItemTransferPayload = {
  source_type: "hero" | "hireling" | "henchmen_group" | "stash";
  source_id?: number | null;
  target_type: "hero" | "hireling" | "henchmen_group" | "stash";
  target_id?: number | null;
  item_id: number;
  quantity: number;
  /** From the stash: only copies of this cost (null: of unknown cost). */
  cost?: number | null;
};

export type WarbandItemSalePayload = {
  source_type: "hero" | "hireling" | "henchmen_group" | "stash";
  source_id?: number | null;
  item_id: number;
  quantity: number;
  price: number;
  /** From the stash: only copies of this cost (null: of unknown cost). */
  cost?: number | null;
};

export type WarbandItemMutationResponse = {
  summary: WarbandUnitsSummary;
  source: WarbandUnitDetail | WarbandItemSummary | null;
  target?: WarbandUnitDetail | WarbandItemSummary | null;
  stash_item?: WarbandItemSummary | null;
  removed_stash_item_id?: number | null;
};

/** Who entered a ledger row by hand (decision 6); null for automatic and older rows. */
export type TradeAuthor = { id: number; name: string };

/** `price` is signed (decision 4): negative when gold left the warband. */
export type WarbandTradeChild = {
  id: number;
  action: string;
  description: string;
  price: number;
  notes: string;
  created_by?: TradeAuthor | null;
  /** The row an Adjustment corrects (decision 5). */
  corrects_id?: number | null;
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
  created_by?: TradeAuthor | null;
  corrects_id?: number | null;
  children: WarbandTradeChild[];
  created_at: string;
  updated_at: string;
};

/** A manual entry. `price`: signed for an Adjustment, otherwise 0 or more (the server signs it). */
export type WarbandTradePayload = {
  action: string;
  description: string;
  price: number;
  notes?: string;
  parent_id?: number | null;
  corrects_id?: number | null;
};

/** What can change on a row entered by hand: never its gold (decision 6). */
export type WarbandTradeEdit = { description?: string; notes?: string };
