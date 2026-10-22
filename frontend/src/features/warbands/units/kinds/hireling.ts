import { getHeroLevelInfo } from "../../components/heroes/utils/hero-level";
import HirelingCardHeader from "../../components/units/kinds/hireling/HirelingCardHeader";
import {
  HirelingExpandedTiles,
  HirelingExpandedTitle,
  HirelingPendingDialogs,
} from "../../components/units/kinds/hireling/HirelingCardSlots";
import HirelingFormBasics from "../../components/units/kinds/hireling/HirelingFormBasics";
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
import {
  armourSaveToForm,
  buildArmourSavePayload,
  buildLevelUpPayload,
  buildStatPayload,
  mapLevelUpToForm,
  mapStatsToForm,
  normalizeCaster,
} from "../unit-form-helpers";
import { FOLLOW_UP_ROLL_TABLE } from "./hero";
import { hirelingEditor } from "./hireling-editor";
import { buildLoadoutPayload, validateHeroForm } from "./hero-forms";

import type { HirelingFormEntry, WarbandHireling } from "../../types/warband-types";
import type { UnitKindConfig } from "../unit-kind-types";

export const mapHirelingToForm = (hireling: WarbandHireling): HirelingFormEntry => ({
  id: hireling.id,
  name: hireling.name ?? "",
  unit_type: hireling.unit_type ?? "",
  race_id: hireling.race_id ?? null,
  race_name: hireling.race_name ?? "",
  race: hireling.race ?? null,
  stats: mapStatsToForm(hireling),
  xp: hireling.xp?.toString() ?? "0",
  ...mapLevelUpToForm(hireling),
  price: hireling.price?.toString() ?? "0",
  upkeep_price: hireling.upkeep_price?.toString() ?? "0",
  rating: hireling.rating?.toString() ?? "0",
  armour_save: armourSaveToForm(hireling.armour_save),
  deeds: hireling.deeds ?? "",
  is_leader: false,
  trading_action: false,
  large: Boolean(hireling.large),
  caster: normalizeCaster(hireling.caster),
  half_rate: Boolean(hireling.half_rate),
  blood_pacted: Boolean(hireling.blood_pacted),
  no_level_ups: Boolean(hireling.no_level_ups),
  available_skills: parseAvailableSkills(hireling.available_skills),
  items: hireling.items ?? [],
  skills: hireling.skills ?? [],
  spells: hireling.spells ?? [],
  specials: hireling.specials ?? [],
});

export const validateHirelingForm = (hireling: HirelingFormEntry) => validateHeroForm(hireling);

export const hirelingKind: UnitKindConfig<"hireling"> = {
  key: "hireling",
  section: "hirelings",
  listKey: "hirelings",
  collection: "hirelings",
  cardClassName: "warband-card--hireling",
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
    formIdPrefix: "hireling",
  },
  flags: {
    hasSpells: true,
    hasMembers: false,
    hasTradeAction: false,
    canLead: false,
    supportsNoLevelUps: true,
    hasUpkeep: true,
    hasPendingAdvances: true,
    reportsMoveTarget: true,
    scrollsIntoViewOnExpand: true,
    savesWarbandHeader: false,
  },
  // Hired swords level on the heroes' table, the campaign's hero thresholds (decision 8).
  thresholdsKey: "hero_level_thresholds",
  advanceOptions: [...HERO_SELECTABLE_STATS, ...OTHER_OPTIONS.map((option) => option.id)],
  getLevelInfo: getHeroLevelInfo,
  showsXpBar: (hireling) => !hireling.no_level_ups,
  canLevelUp: (hireling) => !hireling.no_level_ups && Boolean(hireling.level_up),
  killCount: (hireling) => hireling.kills ?? 0,
  mapToForm: mapHirelingToForm,
  validate: validateHirelingForm,
  // The armour save as a number, like every kind (decision 11, BUG-87).
  buildPayload: (entry, { isSessionCreated }) => ({
    name: entry.name.trim() || null,
    unit_type: entry.unit_type.trim() || null,
    race: entry.race_id ?? null,
    price: toNullableNumber(entry.price) ?? 0,
    upkeep_price: toNullableNumber(entry.upkeep_price) ?? 0,
    rating: toNullableNumber(entry.rating) ?? 0,
    xp: toNullableNumber(entry.xp) ?? 0,
    deeds: entry.deeds.trim() || null,
    armour_save: buildArmourSavePayload(entry.armour_save),
    large: entry.large,
    caster: entry.caster,
    half_rate: entry.half_rate,
    no_level_ups: entry.no_level_ups,
    blood_pacted: entry.blood_pacted,
    available_skills: buildAvailableSkillsPayload(entry.available_skills),
    ...buildStatPayload(entry),
    ...buildLevelUpPayload(entry, isSessionCreated),
    ...buildLoadoutPayload(entry),
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
    SummaryHeader: HirelingCardHeader,
    ExpandedTitle: HirelingExpandedTitle,
    ExpandedTiles: HirelingExpandedTiles,
    PendingAdvanceDialogs: HirelingPendingDialogs,
    FormBasics: HirelingFormBasics,
  },
  editor: hirelingEditor,
};
