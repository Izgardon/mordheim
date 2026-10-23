/**
 * Beasts in the warband (the bestiary rewrite, step 4): a mount or a pet is switched on for the
 * unit holding its Animal item, and a creature is recruited into henchmen. The server works out
 * what a mount changes; the unit's own stats never change.
 */
import type { BeastKind } from "@/features/bestiary/bestiary-kinds";

/** A beast's profile (null on the payloads for a beast without one). */
export type CompanionStats = {
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
};

/** A beast's skill, special or spell as a companion brings it (the unit's detail columns). */
export type CompanionAbility = {
  id: number;
  name: string;
  type?: string;
  description?: string;
  dc?: string | number | null;
};

/**
 * What a switched-on companion brings to its unit (step 5): its beast's skills, specials and
 * spells, shown with the unit's own and never part of them (older caches may lack them).
 */
export type CompanionAbilities = {
  skills?: CompanionAbility[];
  specials?: CompanionAbility[];
  spells?: CompanionAbility[];
};

/** The unit's mount: its first switched-on mount, by item row. */
export type UnitMount = CompanionAbilities & {
  /** The copy the switch names to switch it off. */
  item_row_id: number;
  item_id: number;
  name: string;
  /** The mount's M (null without a profile: the rider keeps his own). */
  movement: number | null;
  /** What the mount adds to the warband rating, once per rider. */
  rating_bonus: number;
  has_profile: boolean;
  stats: CompanionStats | null;
};

export type UnitPet = CompanionAbilities & {
  item_row_id: number;
  item_id: number;
  name: string;
  has_profile: boolean;
  stats: CompanionStats | null;
};

/** What a mounted unit shows (null on foot): shown beside its own stats, never written to them. */
export type EffectiveStats = { movement: number | null; armour_save: number | null };

/** The companion fields every unit payload carries (older caches may lack them). */
export type UnitCompanionFields = {
  mount?: UnitMount | null;
  /**
   * A henchmen group's: each kind of mount its members ride, its first copy of each (the first is
   * `mount`), so a group on a Warhorse and a Pony brings both beasts' entries.
   */
  mounts?: UnitMount[];
  pets?: UnitPet[];
  effective_stats?: EffectiveStats | null;
};

/** A henchmen group recruited from a creature: its beast (null for any other group). */
export type CreatureGroupFields = {
  source_beast_id?: number | null;
  beast_kind?: BeastKind | null;
};

/** A warning the server answered with while the change went ahead (warn, never block). */
export type ServerWarning = { code: string; message: string } & Record<string, unknown>;
