import type {
  BattleRosterCompanion,
  BattleRosterCompanionFields,
  BattleRosterMissingFields,
} from "@/features/battles/types/battle-types";
import type { BattleWarning } from "@/features/battles/utils/battle-warnings";

export type NumericStatKey =
  | "movement"
  | "weapon_skill"
  | "ballistic_skill"
  | "strength"
  | "toughness"
  | "wounds"
  | "initiative"
  | "attacks"
  | "leadership"
  | "armour_save";

export type StatKey = NumericStatKey;

export type UnitStats = Record<NumericStatKey, number | null>;
export type DraftUnitStats = Record<NumericStatKey, string>;

export type UnitSingleUseItem = {
  id: number;
  name: string;
  quantity: number;
  description?: string;
};

export type UnitDetailEntry = {
  id: number;
  name: string;
};

export type UnitSpellDetailEntry = UnitDetailEntry & {
  dc?: string | number | null;
};

export type UnitItemEntry = UnitDetailEntry & {
  count: number;
  singleUse: boolean;
};

export type PrebattleUnit = BattleRosterCompanionFields & {
  key: string;
  id: number | string;
  kind: "hero" | "hireling" | "henchman" | "custom" | "bestiary" | "pet";
  /** A pet fighting as its own model (step 5): its owner's unit key, or `group:<id>`. */
  ownerKey?: string;
  displayName: string;
  unitType: string;
  /** How many more games it misses, and why (`BattleRosterMissingFields`). */
  missingGames?: number;
  missingReason?: string;
  stats: UnitStats;
  upkeepPrice?: number | null;
  upkeepCostExpression?: string | null;
  singleUseItems?: UnitSingleUseItem[];
  items?: UnitItemEntry[];
  skills?: UnitDetailEntry[];
  spells?: UnitSpellDetailEntry[];
  specials?: UnitDetailEntry[];
  rating?: number;
  noLevelUps?: boolean;
  /** Hirelings: what it is, the injury table it rolls on, how long it stays, what it is paid in. */
  hirelingKind?: "hired_sword" | "dramatis_persona";
  injuryTable?: "henchman" | "hero";
  stays?: "always" | "one_battle";
  paymentNote?: string;
};

export type HenchmenGroupRoster = BattleRosterMissingFields & {
  id: number;
  name: string;
  unitType: string;
  /** A group recruited from a creature: its beast (null otherwise). */
  sourceBeastId?: number | null;
  beastKind?: "mount" | "pet" | "creature" | null;
  /** The group's own pets (a keyed one fights as its own model, step 5). */
  pets?: BattleRosterCompanion[];
  /**
   * A mounted group's mount warnings (the warband page's): every member carries the same gear, so
   * a group short of mounts, or on more than one kind, is noted in prebattle. Never a block.
   */
  mountWarnings?: BattleWarning[];
  members: PrebattleUnit[];
};

export type ParticipantRoster = {
  heroes: PrebattleUnit[];
  hirelings: PrebattleUnit[];
  henchmenGroups: HenchmenGroupRoster[];
  /** Its pets with a profile, as models next to their owners (step 5; built from the roster). */
  petModels?: PrebattleUnit[];
};

export type UnitOverride = {
  stats: Partial<UnitStats>;
};

export type StatField = { key: StatKey; label: string; input: "number" | "text" };

export const STAT_FIELDS: StatField[] = [
  { key: "movement", label: "M", input: "number" },
  { key: "weapon_skill", label: "WS", input: "number" },
  { key: "ballistic_skill", label: "BS", input: "number" },
  { key: "strength", label: "S", input: "number" },
  { key: "toughness", label: "T", input: "number" },
  { key: "wounds", label: "W", input: "number" },
  { key: "initiative", label: "I", input: "number" },
  { key: "attacks", label: "A", input: "number" },
  { key: "leadership", label: "Ld", input: "number" },
  { key: "armour_save", label: "AS", input: "number" },
];

export const DEFAULT_STATS: UnitStats = {
  movement: 0,
  weapon_skill: 0,
  ballistic_skill: 0,
  strength: 0,
  toughness: 0,
  wounds: 0,
  initiative: 0,
  attacks: 0,
  leadership: 0,
  armour_save: null,
};

export type CustomUnitDraft = {
  name: string;
  unitType: string;
  rating: string;
  stats: DraftUnitStats;
};

export const DEFAULT_CUSTOM_UNIT_DRAFT: CustomUnitDraft = {
  name: "",
  unitType: "",
  rating: "",
  stats: {
    movement: "",
    weapon_skill: "",
    ballistic_skill: "",
    strength: "",
    toughness: "",
    wounds: "",
    initiative: "",
    attacks: "",
    leadership: "",
    armour_save: "",
  },
};
