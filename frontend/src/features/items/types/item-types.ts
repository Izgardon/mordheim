import type { BeastKind } from "@/features/bestiary/bestiary-kinds";
import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

/**
 * One line of a who-can list (the items rebuild): a warband type or a warband group (one of the
 * two ids is null), may or may not (`excluded`). A price row says who may buy it with these, a
 * hired sword or dramatis persona who may hire him, a special skill who may learn it.
 */
export type AccessLine = {
  warband_type_id: number | null;
  warband_group_id: number | null;
  name: string;
  /** A type's source code ("BTB"), which tells two types of one name apart; blank for a group. */
  source_code?: string;
  excluded: boolean;
};

/** A who-can line as a write sends it. */
export type AccessLineInput = {
  warband_type_id?: number | null;
  warband_group_id?: number | null;
  excluded: boolean;
};

/** A shared rule (Parry, Concussion): the book's, or one a campaign added. */
export type ItemRule = {
  id: number;
  campaign_id: number | null;
  name: string;
  summary: string;
  text: string;
};

/** A D6 table: its column headings ("D6", "Result") and its rows, the roll first. */
export type RuleTable = { columns: string[]; rows: string[][] };

/**
 * One of an item's rules as it reads: a shared rule (`shared`, worded the item's own way where it
 * differs) or one only this item has. `{{table:N}}` in the text marks where the Nth table stands.
 */
export type ItemRuleLink = {
  id: number;
  rule_id: number | null;
  shared: boolean;
  name: string;
  summary: string;
  text: string;
  table: RuleTable[];
  /** Its pre-battle roll ("D6"; "" for none) and what it does: a shared rule's, or its own rule's. */
  prebattle_roll?: string;
  prebattle_text?: string;
};

/**
 * One price of an item: its cost (null: see the cost note) with dice ("25 + 2D6", "200 +
 * D6×25"), its rarity (null: Common), a label naming a variant row ("Brace"), a note shown when
 * buying and never checked ("Heroes only"), and who may buy it: everyone (minus the excluded
 * lines) or the lines it names.
 */
export type ItemAvailability = {
  id: number;
  label: string;
  cost: number | null;
  dice: number | null;
  dice_multiplier: number | null;
  cost_note: string;
  rarity: number | null;
  for_everyone: boolean;
  warbands: AccessLine[];
  /**
   * Who may buy the row, in the server's words, when not everyone may ("For Skaven and
   * Lizardmen.", "Not available for Dark Elves."); "" (or missing) for everyone.
   */
  who_text?: string;
  note: string;
};

export type AvailabilityPayload = {
  label: string;
  cost: number | null;
  dice: number | null;
  dice_multiplier: number | null;
  cost_note: string;
  rarity: number | null;
  for_everyone: boolean;
  note: string;
  warbands: AccessLineInput[];
};

export type RuleLinkPayload = {
  rule_id: number | null;
  name: string;
  summary: string;
  text: string;
  table: RuleTable[];
  /** A rule of its own's pre-battle roll (a shared rule's link keeps none). */
  prebattle_roll?: string;
  prebattle_text?: string;
};

/** Where a suggested sale price comes from (decision 3). */
export type SalePriceBasis = "campaign_price" | "stored_cost";

export type Item = CatalogueBadgeFields & {
  id: number;
  campaign_id?: number | null;
  /** Its setting, which holds its grade (null: a campaign's own item). */
  setting_id?: number | null;
  /** Set on a house rule's clone of a catalogue item (BUG-51): it changes with its rule only. */
  generated_effect_key?: string | null;
  name: string;
  /** Tells apart two items of one name, shown in brackets ("Mutiny in Marienburg"). */
  variant?: string;
  type: string;
  subtype?: string;
  /** The fluff, kept apart from the rules. */
  flavour?: string;
  /** "Town Cryer #6", and the mordheimer or Broheim page. */
  source?: string;
  link_url?: string;
  /** Search words: "scimitar" finds Sword. */
  tags?: string[];
  /** Editor's notes ("In older material the Dragon Sword was called Katana"). */
  notes?: string;
  /** Cost from the join table (HeroItem.cost, WarbandItem.cost) when loaded via warband APIs. */
  cost?: number | null;
  /** A unit's copy in a detail payload: one copy's suggested sale price (null: none known). */
  suggested_sale_price?: number | null;
  /** A unit's copy: what Buy again charges, the campaign's current price (null: unknown). */
  current_price?: number | null;
  sale_price_basis?: SalePriceBasis | null;
  /** A unit's copy: its own row (item ids repeat when a unit carries two), which the switch names. */
  row_id?: number;
  /** A henchmen group's loadout row: the living members who carry it (one copy each, less gaps). */
  carriers?: number;
  /** A unit's copy of a mount or pet: switched on for the unit (it rides it, it keeps it). */
  companion?: boolean;
  /** A unit's copy: what it is made of (weapon materials; "" plain) and what it is called. */
  material?: string;
  material_name?: string;
  /**
   * What each price row comes to for a weapon made of each material, the server's prices:
   * `{row id: {slug: price}}`. Only a weapon has any, and a row with dice none (its price isn't
   * known until the dice are rolled).
   */
  material_prices?: Record<string, Record<string, number>>;
  /** A unit's copy of an Animal item: its beast's kind (null for any other item). */
  beast_kind?: BeastKind | null;
  single_use?: boolean;
  strength?: string | null;
  range?: string | null;
  save?: string | null;
  /** The steps equipping it moves the wearer's save (null: none by itself). */
  save_bonus?: number | null;
  /** JSON: a vehicle's or an animal's profile rows. */
  statblock?: string | null;
  rules?: ItemRuleLink[];
  availabilities: ItemAvailability[];
  /**
   * The shop sells it (default). Only an Animal item can be unlisted: its beast's "Available in
   * the shop" is off, so the shop and Acquire leave it out.
   */
  listed?: boolean;
  /** An Animal item's beast: every beast has one item, written only through the bestiary. */
  bestiary_entry?: {
    id: number;
    name: string;
    kind: BeastKind;
    /** Off: the stats are stored as 0 and shown as "No profile". */
    has_profile: boolean;
    movement: number;
    weapon_skill: number;
    ballistic_skill: number;
    strength: number;
    toughness: number;
    wounds: number;
    initiative: number;
    attacks: number;
    leadership: number;
    armour_save: number | null;
    specials: { id: number; name: string; description: string }[];
  } | null;
};

export type ItemWritePayload = {
  name: string;
  variant: string;
  type: string;
  subtype: string;
  single_use: boolean;
  flavour: string;
  strength: string | null;
  range: string | null;
  save: string | null;
  source: string;
  link_url: string;
  tags: string[];
  notes: string;
  rules: RuleLinkPayload[];
  availabilities: AvailabilityPayload[];
};

export type ItemCreatePayload = ItemWritePayload & { campaign_id: number };

/** A book item's edit names the campaign whose version it makes or changes. */
export type ItemUpdatePayload = Partial<ItemWritePayload> & { campaign_id?: number };

/**
 * What one item offers a warband (`GET warbands/<id>/who-can/`): the price row it sees, the other
 * rows it may use (the chosen first), whether it can usually buy it, and why not ("Not available
 * for Skaven.", "Khemri isn't in this campaign."). The server decides; pages show it.
 */
export type ItemOffer = {
  item_id: number;
  availability_id: number;
  options: number[];
  can_buy: boolean;
  reason: string;
  /**
   * The store offers it to any unit whatever their own list sells (William, 20 Nov 2026): an
   * animal or a miscellaneous item the warband reaches as everyone does, so no row of it names a
   * warband. The server decides it; Their list reads it for a hero.
   */
  always_open?: boolean;
  /**
   * The items it counts as on a unit's own list, while its setting is in play (Gromril and
   * Ithilmar Armour count as Heavy Armour): Their list offers it to a hero whose list sells one.
   */
  counts_as?: number[];
};

/** Whether a warband can usually hire a hired sword or dramatis persona, and why not. */
export type HireAccess = { id: number; can_hire: boolean; reason: string };

/**
 * One weapon material as the warband sees it (weapon materials): its own name, the word it puts in
 * front of a weapon's name ("Dark Elf Blade" makes a "Dark Elf Sword"), the rarity the purchase
 * rolls (never the weapon's), how it prices in the book's words, the book's rules, and whether this
 * warband may usually take it. The server words the reason; pages show it and never re-derive it.
 */
export type WeaponMaterial = {
  slug: string;
  name: string;
  /** What its store row is called: "Gromril Weapon", "Dark Elf Blade" (the server's wording). */
  row_name: string;
  /** The word in front of the weapon's name: "Gromril", "Dark Elf". */
  prefix: string;
  rarity: number;
  /** Open to anyone its setting reaches (gromril, ithilmar): no warband is named either way. */
  for_everyone: boolean;
  price_note: string;
  multiplier: number | null;
  addition: number | null;
  rules: { name: string; text: string }[];
  can_take: boolean;
  reason: string;
  /** Whether its setting is in play: Their list leaves out one that isn't (William, 22 Nov 2026). */
  in_play?: boolean;
  /**
   * A rule naming the only weapons it may be made of (the Dark Elf Blade's swords and daggers):
   * the items it allows and the rule's own sentence. null: every melee weapon may be made of it.
   */
  only: { text: string; item_ids: number[] } | null;
};

/** `GET warbands/<id>/who-can/`: what the warband can usually buy, hire and learn. */
export type WhoCan = {
  items: ItemOffer[];
  hired_swords: HireAccess[];
  dramatis_personae: HireAccess[];
  /** The skill groups open to it (its type, its group, or everyone), in group order. */
  skill_group_ids: number[];
  /** The skills of the groups that name its type or group. */
  special_skill_ids: number[];
  /** The four weapon materials, in registry order. */
  materials: WeaponMaterial[];
};

/** A race or a side a who-can list may name (`GET warband-groups/`). */
export type WarbandGroup = { id: number; slug: string; name: string; kind: "race" | "side" };
