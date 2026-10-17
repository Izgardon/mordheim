import { getHenchmenLevelInfo } from "../../components/henchmen/utils/henchmen-level";
import HiredSwordCardHeader from "../../components/units/kinds/hired-sword/HiredSwordCardHeader";
import {
  HiredSwordExpandedTiles,
  HiredSwordExpandedTitle,
  HiredSwordPendingDialogs,
} from "../../components/units/kinds/hired-sword/HiredSwordCardSlots";
import HiredSwordFormBasics from "../../components/units/kinds/hired-sword/HiredSwordFormBasics";
import { useFollowUpAdvance } from "../../hooks/units/useFollowUpAdvance";
import {
  HERO_SELECTABLE_STAT_SET,
  HERO_SELECTABLE_STATS,
  OTHER_OPTIONS,
} from "../../utils/levelup-utils";
import {
  buildAvailableSkillsPayload,
  parseAvailableSkills,
  toNullableNumber,
} from "../../utils/warband-utils";
import { buildStatPayload, mapStatsToForm, normalizeCaster } from "../unit-form-helpers";
import { FOLLOW_UP_ROLL_TABLE } from "./hero";
import { hiredSwordEditor } from "./hired-sword-editor";
import { buildLoadoutPayload, validateHeroForm } from "./hero-forms";

import type { HiredSwordFormEntry, WarbandHiredSword } from "../../types/warband-types";
import type { UnitKindConfig } from "../unit-kind-types";

export const mapHiredSwordToForm = (hiredSword: WarbandHiredSword): HiredSwordFormEntry => ({
  id: hiredSword.id,
  name: hiredSword.name ?? "",
  unit_type: hiredSword.unit_type ?? "",
  race_id: hiredSword.race_id ?? null,
  race_name: hiredSword.race_name ?? "",
  race: hiredSword.race ?? null,
  stats: mapStatsToForm(hiredSword),
  xp: hiredSword.xp?.toString() ?? "0",
  price: hiredSword.price?.toString() ?? "0",
  upkeep_price: hiredSword.upkeep_price?.toString() ?? "0",
  rating: hiredSword.rating?.toString() ?? "0",
  armour_save: hiredSword.armour_save != null ? String(hiredSword.armour_save) : "",
  deeds: hiredSword.deeds ?? "",
  is_leader: false,
  trading_action: false,
  large: Boolean(hiredSword.large),
  caster: normalizeCaster(hiredSword.caster),
  half_rate: Boolean(hiredSword.half_rate),
  blood_pacted: Boolean(hiredSword.blood_pacted),
  no_level_ups: Boolean(hiredSword.no_level_ups),
  available_skills: parseAvailableSkills(hiredSword.available_skills),
  items: hiredSword.items ?? [],
  skills: hiredSword.skills ?? [],
  spells: hiredSword.spells ?? [],
  specials: hiredSword.specials ?? [],
});

export const validateHiredSwordForm = (hiredSword: HiredSwordFormEntry) =>
  validateHeroForm(hiredSword);

export const hiredSwordKind: UnitKindConfig<"hired_sword"> = {
  key: "hired_sword",
  section: "hiredswords",
  listKey: "hiredSwords",
  collection: "hired_swords",
  cardClassName: "warband-card--hired-sword",
  summaryLoadoutClassName: "mt-auto",
  labels: {
    plural: "Hired Swords",
    singular: "Hired Sword",
    edit: "Edit Hired Swords",
    add: "Add hired sword",
    create: "Create hired sword",
    fallbackName: (index) => `Hired Sword ${index + 1}`,
    untitled: "Untitled hired sword",
    typeFallback: "Hired Sword",
    unnamed: "Unnamed Hired Sword",
    killsName: "hired sword",
    empty: "No hired swords yet.",
    dismiss: "Dismiss",
    dismissConfirm: "Dismiss hired sword",
    dismissVerb: "dismiss",
    draftNoun: "hired sword",
    saveError: "Unable to update hired swords",
    unknownName: "Unknown Hired Sword",
    newUnit: "New Hired Sword",
    addNew: "Add new",
    formIdPrefix: "hired-sword",
  },
  flags: {
    hasSpells: true,
    hasMembers: false,
    hasTradeAction: false,
    canLead: false,
    supportsNoLevelUps: true,
    hasUpkeep: true,
    xpBarHalfRate: true,
    hasPendingAdvances: true,
    reportsMoveTarget: true,
    scrollsIntoViewOnExpand: true,
    savesWarbandHeader: false,
    announcesUnitUpdates: true,
  },
  thresholdsKey: "hired_sword_level_thresholds",
  advanceOptions: [...HERO_SELECTABLE_STATS, ...OTHER_OPTIONS.map((option) => option.id)],
  // Hired swords count levels like henchmen: whole XP, henchmen default table.
  getLevelInfo: getHenchmenLevelInfo,
  showsXpBar: (hiredSword) => !hiredSword.no_level_ups,
  canLevelUp: (hiredSword) => !hiredSword.no_level_ups && Boolean(hiredSword.level_up),
  killCount: (hiredSword) => hiredSword.kills ?? 0,
  mapToForm: mapHiredSwordToForm,
  validate: validateHiredSwordForm,
  // Armour save stays the typed string (BUG-87).
  buildPayload: (entry, { isSessionCreated }) => ({
    name: entry.name.trim() || null,
    unit_type: entry.unit_type.trim() || null,
    race: entry.race_id ?? null,
    price: toNullableNumber(entry.price) ?? 0,
    upkeep_price: toNullableNumber(entry.upkeep_price) ?? 0,
    rating: toNullableNumber(entry.rating) ?? 0,
    xp: toNullableNumber(entry.xp) ?? 0,
    deeds: entry.deeds.trim() || null,
    armour_save: entry.armour_save.trim() || null,
    large: entry.large,
    caster: entry.caster,
    half_rate: entry.half_rate,
    no_level_ups: entry.no_level_ups,
    blood_pacted: entry.blood_pacted,
    available_skills: buildAvailableSkillsPayload(entry.available_skills),
    ...buildStatPayload(entry),
    ...(isSessionCreated ? { level_up: 0 } : {}),
    ...buildLoadoutPayload(entry),
  }),
  buildXpPayload: (hiredSword, xp) => ({
    name: hiredSword.name,
    unit_type: hiredSword.unit_type,
    race: hiredSword.race_id ?? null,
    price: hiredSword.price,
    upkeep_price: hiredSword.upkeep_price ?? 0,
    xp,
  }),
  levelUp: {
    selectableStats: HERO_SELECTABLE_STAT_SET,
    rollTable: FOLLOW_UP_ROLL_TABLE,
    nameFallback: "Unknown Hired Sword",
    useAdvance: useFollowUpAdvance,
  },
  addForm: {
    actionsClassName: "flex flex-wrap items-center justify-end gap-3",
    buttonWrapperClassName: "scroll-mt-28",
  },
  slots: {
    SummaryHeader: HiredSwordCardHeader,
    ExpandedTitle: HiredSwordExpandedTitle,
    ExpandedTiles: HiredSwordExpandedTiles,
    PendingAdvanceDialogs: HiredSwordPendingDialogs,
    FormBasics: HiredSwordFormBasics,
  },
  editor: hiredSwordEditor,
};
