import type { LevelInfo } from "../components/heroes/utils/hero-level";
import type { LevelUpCore, UnitAdvance } from "../hooks/units/level-up-types";
import type { Unit, UnitForm, UnitKindKey, UnitPayload, UnitSectionKey } from "../types/units";
import type { UnitValidationError } from "./unit-form-helpers";

export type UnitThresholdsKey =
  | "hero_level_thresholds"
  | "henchmen_level_thresholds"
  | "hired_sword_level_thresholds";

/** Every piece of copy that differs between the kinds. */
export type UnitKindLabels = {
  /** Section title: "Heroes", "Henchmen", "Hired Swords". */
  plural: string;
  /** Form card heading prefix: "Hero 1", "Henchmen Group 1", "Hired Sword 1". */
  singular: string;
  edit: string;
  add: string;
  create: string;
  /** Name fallback on form cards and dialogs: "Hero 2", "Group 2", "Hired Sword 2". */
  fallbackName: (index: number) => string;
  /** Summary card fallbacks. */
  untitled: string;
  typeFallback: string;
  /** Expanded card heading fallback. */
  unnamed: string;
  loadingDetails: string;
  detailError: string;
  /** "Show named kills for <name>" fallback. */
  killsName: string;
  empty: string;
  dismiss: string;
  dismissConfirm: string;
  dismissVerb: string;
};

export type UnitKindFlags = {
  hasSpells: boolean;
  hasMembers: boolean;
  hasTradeAction: boolean;
  canLead: boolean;
  supportsNoLevelUps: boolean;
  hasUpkeep: boolean;
  /** The XP bar steps 0.5 for half-rate units (henchmen bars ignore it: BUG-33). */
  xpBarHalfRate: boolean;
  /** After an item move, a same-kind target is reported through the update callback. */
  reportsMoveTarget: boolean;
  /** The section scrolls itself into view when a unit expands (desktop). */
  scrollsIntoViewOnExpand: boolean;
};

export type UnitLevelUpConfig<K extends UnitKindKey> = {
  /** Stats the advance table offers a checkbox for. */
  selectableStats: ReadonlySet<string>;
  /** The roll table behind the Advance info icon. */
  rollTable: { lines: readonly string[]; footnote?: string; maxWidth: number };
  /** Payload name when the unit has neither a name nor a type. */
  nameFallback: string;
  /** The kind's advance rules: hero/hired-sword follow-up rolls or henchmen Lad's Got Talent. */
  useAdvance: (core: LevelUpCore<K>) => UnitAdvance;
};

export type UnitPayloadContext = {
  /** The unit was created in this edit session (henchmen and hired swords then send level_up 0). */
  isSessionCreated: boolean;
};

/**
 * One kind's data and mappers (design 0.28 §5.2). Generic components read their differences from
 * here; differences that are behaviour live in slots added by the components that use them.
 */
export type UnitKindConfig<K extends UnitKindKey> = {
  key: K;
  section: UnitSectionKey;
  labels: UnitKindLabels;
  flags: UnitKindFlags;
  thresholdsKey: UnitThresholdsKey;
  /** Display only: the server validates advances. */
  advanceOptions: readonly string[];
  getLevelInfo: (xp: number | null | undefined, thresholds?: readonly number[]) => LevelInfo;
  /** Whether a payload already carries the detail fields, or the card must fetch the unit. */
  hasDetail: (unit: Unit<K>) => boolean;
  showsXpBar: (unit: Unit<K>) => boolean;
  canLevelUp: (unit: Unit<K>) => boolean;
  mapToForm: (unit: Unit<K>) => UnitForm<K>;
  validate: (form: UnitForm<K>) => UnitValidationError | null;
  /** The PATCH body Save sends for a changed form. */
  buildPayload: (form: UnitForm<K>, context: UnitPayloadContext) => Partial<UnitPayload<K>>;
  /** The PATCH body the XP bar sends (the whole unit today: BUG-63). */
  buildXpPayload: (unit: Unit<K>, xp: number) => Partial<UnitPayload<K>>;
  levelUp: UnitLevelUpConfig<K>;
};
