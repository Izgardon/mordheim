import type { ComponentType } from "react";

import type { Skill } from "@/features/skills/types/skill-types";
import type { LevelInfo } from "../components/heroes/utils/hero-level";
import type { AddFieldsSlotProps } from "../components/units/forms/AddFormFields";
import type { UnitFormSlotProps } from "../components/units/forms/form-types";
import type { PendingChangeItem, PendingPurchase } from "../utils/pending-purchases";
import type { LevelUpCore, UnitAdvance } from "../hooks/units/level-up-types";
import type { UnitCardSlots } from "./unit-slot-types";
import type {
  Unit,
  UnitCollectionKey,
  UnitForm,
  UnitKindKey,
  UnitListKey,
  UnitNewForm,
  UnitPayload,
  UnitSectionKey,
} from "../types/units";
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
  /** "Show named kills for <name>" fallback. */
  killsName: string;
  empty: string;
  dismiss: string;
  dismissConfirm: string;
  dismissVerb: string;
  /** "Finish creating the new <noun>", "Fix <noun> details": hero, group, hired sword. */
  draftNoun: string;
  /** Save failure without a server message. */
  saveError: string;
  /** Purchase log name for a form without a name. */
  unknownName: string;
  /** Mobile edit navigation: an unnamed form, and the add entry ("Add New" for heroes). */
  newUnit: string;
  addNew: string;
  /** Edit-card anchor ids: warband-mobile-edit-<section>-<prefix>-<id>. */
  formIdPrefix: string;
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
  /** Pending "New Skill/Spell/Special" entries open their own dialogs. */
  hasPendingAdvances: boolean;
  /** After an item move, a same-kind target is reported through the update callback. */
  reportsMoveTarget: boolean;
  /** The section scrolls itself into view when a unit expands (desktop). */
  scrollsIntoViewOnExpand: boolean;
  /** Heroes save the warband's name and faction with the section and get the summary back. */
  savesWarbandHeader: boolean;
  /** Card updates (XP, level-ups) are announced, which refreshes the summary (PERF-27). */
  announcesUnitUpdates: boolean;
};

/** Caps and counts the sections compare against (campaign settings, warband size, roster). */
export type RosterLimits = {
  maxHeroes: number;
  maxHiredSwords: number;
  maxUnits: number;
  heroCount: number;
  henchmanCount: number;
  bloodPactedCount: number;
};

export type UnitLimits = {
  titleSuffix: string;
  /** "Create <unit>" refuses with the kind's blocked error. */
  isCreateBlocked: boolean;
  isAddDisabled: boolean;
  /** Under the "Add" button (henchmen: the warband unit limit). */
  addButtonNotice?: string;
  /** Under the add form ("Maximum of 6 heroes reached."). */
  addFormNotices: string[];
  /** Henchmen: blocks "+ Add henchman" on the edit cards. */
  isUnitLimitReached: boolean;
};

export type UnitCreationConfig<K extends UnitKindKey> = {
  initialForm: UnitNewForm<K>;
  blockedError: string;
  failureError: string;
  /** A check beyond name, type and race (henchmen need a first member). */
  extraError?: (form: UnitNewForm<K>) => string | null;
  toFormEntry: (form: UnitNewForm<K>, name: string, unitType: string) => UnitForm<K>;
  /** The add form has content, so Save asks to finish or cancel it first. */
  isDraftDirty: (form: UnitNewForm<K>, raceQuery: string) => boolean;
  /** The POST body of "Create <unit>". */
  buildPayload: (entry: UnitForm<K>) => UnitPayload<K>;
  /** The edit form kept for the created unit. */
  formAfterCreate: (entry: UnitForm<K>, created: Unit<K>) => UnitForm<K>;
};

export type UnitEditorConfig<K extends UnitKindKey> = {
  creation: UnitCreationConfig<K>;
  limits: (input: {
    units: Unit<K>[];
    forms: UnitForm<K>[];
    isEditing: boolean;
    newForm: UnitNewForm<K>;
    roster: RosterLimits;
  }) => UnitLimits;
  buildPendingChanges: (purchases: PendingPurchase[], forms: UnitForm<K>[]) => PendingChangeItem[];
  /** Henchmen: take stash picks out of the stash after the writes; resolves with the count. */
  afterSaveWrites?: (warbandId: number, forms: UnitForm<K>[]) => Promise<number>;
  /** Extra edit-card props (henchmen: stash quantities, loaded when editing starts). */
  useFormExtras: (
    warbandId: number,
    forms: UnitForm<K>[]
  ) => { cardProps: Partial<UnitFormSlotProps<K>>; onStartEditing?: () => void };
  /** A skill made from the edit card joins the form (heroes replace a pending "New Skill"). */
  addCreatedSkill: (form: UnitForm<K>, skill: Skill) => UnitForm<K>;
  /** The add form's fields. */
  AddFields: ComponentType<AddFieldsSlotProps<K>>;
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
  /** Key of the kind's list in a warband update ("heroes", "henchmenGroups", "hiredSwords"). */
  listKey: UnitListKey;
  /** Key of the kind's list in the sheet ("heroes", "henchmen_groups", "hired_swords"). */
  collection: UnitCollectionKey;
  labels: UnitKindLabels;
  /** Card shell class: warband-card--hero / --henchmen / --hired-sword. */
  cardClassName: string;
  /** Wrapper class around the summary card's loadout ("mt-auto"; heroes have none). */
  summaryLoadoutClassName?: string;
  flags: UnitKindFlags;
  thresholdsKey: UnitThresholdsKey;
  /** Display only: the server validates advances. */
  advanceOptions: readonly string[];
  getLevelInfo: (xp: number | null | undefined, thresholds?: readonly number[]) => LevelInfo;
  showsXpBar: (unit: Unit<K>) => boolean;
  canLevelUp: (unit: Unit<K>) => boolean;
  /** Kills shown on the expanded card (henchmen sum their members'). */
  killCount: (unit: Unit<K>) => number;
  mapToForm: (unit: Unit<K>) => UnitForm<K>;
  validate: (form: UnitForm<K>) => UnitValidationError | null;
  /** The PATCH body Save sends for a changed form. */
  buildPayload: (form: UnitForm<K>, context: UnitPayloadContext) => Partial<UnitPayload<K>>;
  /** The PATCH body the XP bar sends (the whole unit today: BUG-63). */
  buildXpPayload: (unit: Unit<K>, xp: number) => Partial<UnitPayload<K>>;
  levelUp: UnitLevelUpConfig<K>;
  /** The add form's button row (heroes push their buttons right inside a second row). */
  addForm: {
    actionsClassName: string;
    actionsInnerClassName?: string;
    /** Around the "Add <unit>" button (henchmen leave room for the unit-limit notice). */
    buttonWrapperClassName: string;
  };
  slots: UnitCardSlots<K>;
  editor: UnitEditorConfig<K>;
};
