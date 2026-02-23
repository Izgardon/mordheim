export type NumericStatKey =
  | "movement"
  | "weapon_skill"
  | "ballistic_skill"
  | "strength"
  | "toughness"
  | "wounds"
  | "initiative"
  | "attacks"
  | "leadership";

export type StatKey = NumericStatKey | "armour_save";

export type UnitStats = Record<NumericStatKey, number> & { armour_save: string };
export type DraftUnitStats = Record<NumericStatKey, string> & { armour_save: string };

export type UnitSingleUseItem = {
  id: number;
  name: string;
  quantity: number;
  description?: string;
};

export type PrebattleUnit = {
  key: string;
  id: number | string;
  kind: "hero" | "hired_sword" | "henchman" | "custom";
  displayName: string;
  unitType: string;
  stats: UnitStats;
  singleUseItems?: UnitSingleUseItem[];
  rating?: number;
  customReason?: string;
};

export type HenchmenGroupRoster = {
  id: number;
  name: string;
  unitType: string;
  members: PrebattleUnit[];
};

export type ParticipantRoster = {
  heroes: PrebattleUnit[];
  hiredSwords: PrebattleUnit[];
  henchmenGroups: HenchmenGroupRoster[];
};

export type UnitOverride = {
  reason: string;
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
  { key: "armour_save", label: "AS", input: "text" },
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
  armour_save: "",
};

export type CustomUnitDraft = {
  name: string;
  unitType: string;
  reason: string;
  rating: string;
  stats: DraftUnitStats;
};

export const DEFAULT_CUSTOM_UNIT_DRAFT: CustomUnitDraft = {
  name: "",
  unitType: "",
  reason: "",
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
