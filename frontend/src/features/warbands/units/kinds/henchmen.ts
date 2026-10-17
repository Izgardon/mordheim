import { hireCostKey } from "../../components/henchmen/utils/henchmen-cost";
import { getHenchmenLevelInfo } from "../../components/henchmen/utils/henchmen-level";
import {
  HenchmenCardHeader,
  HenchmenExpandedTiles,
  HenchmenExpandedTitle,
  sumMemberKills,
} from "../../components/units/kinds/henchmen/HenchmenCardSlots";
import HenchmenFormBasics from "../../components/units/kinds/henchmen/HenchmenFormBasics";
import HenchmenFormLoadout from "../../components/units/kinds/henchmen/HenchmenFormLoadout";
import { useLadsGotTalentAdvance } from "../../hooks/units/useLadsGotTalentAdvance";
import { HENCHMEN_SELECTABLE_STAT_SET, HENCHMEN_SELECTABLE_STATS } from "../../utils/levelup-utils";
import { toNullableNumber } from "../../utils/warband-utils";
import {
  armourSaveToForm,
  buildArmourSavePayload,
  buildLevelUpPayload,
  buildStatPayload,
  mapLevelUpToForm,
  mapStatsToForm,
  missingIdentityFields,
  toValidationError,
} from "../unit-form-helpers";
import { henchmenEditor } from "./henchmen-editor";
import { buildMembersPayload, computeItemsWithNewHenchmen } from "./henchmen-members";

import type { HenchmenGroup, HenchmenGroupFormEntry } from "../../types/warband-types";
import type { UnitKindConfig } from "../unit-kind-types";

/** No caster, spells or skill access; the group size defaults to 5. */
export const mapHenchmenGroupToForm = (group: HenchmenGroup): HenchmenGroupFormEntry => {
  const form = mapGroupFields(group);
  return { ...form, hireCostFor: hireCostKey(form) };
};

const mapGroupFields = (group: HenchmenGroup): HenchmenGroupFormEntry => ({
  id: group.id,
  name: group.name ?? "",
  unit_type: group.unit_type ?? "",
  race_id: group.race_id ?? null,
  race_name: group.race_name ?? "",
  race: group.race ?? null,
  stats: mapStatsToForm(group),
  xp: group.xp?.toString() ?? "0",
  ...mapLevelUpToForm(group),
  max_size: group.max_size?.toString() ?? "5",
  hire_cost: group.hire_cost,
  price: group.price?.toString() ?? "0",
  armour_save: armourSaveToForm(group.armour_save),
  deeds: group.deeds ?? "",
  large: Boolean(group.large),
  half_rate: Boolean(group.half_rate),
  no_level_ups: Boolean(group.no_level_ups),
  items: group.items ?? [],
  skills: group.skills ?? [],
  specials: group.specials ?? [],
  henchmen: group.henchmen ?? [],
});

/** Like heroes, plus every henchman needs a name. */
export const validateHenchmenGroupForm = (group: HenchmenGroupFormEntry) => {
  const missing = missingIdentityFields(group);
  if (group.henchmen.some((h) => !h.name?.trim())) {
    missing.push("henchmen_names");
  }
  return toValidationError(missing);
};

export const henchmenKind: UnitKindConfig<"henchmen_group"> = {
  key: "henchmen_group",
  section: "henchmen",
  listKey: "henchmenGroups",
  collection: "henchmen_groups",
  cardClassName: "warband-card--henchmen",
  summaryLoadoutClassName: "mt-auto",
  labels: {
    plural: "Henchmen",
    singular: "Henchmen Group",
    edit: "Edit Henchmen",
    add: "Add group",
    create: "Create group",
    fallbackName: (index) => `Group ${index + 1}`,
    untitled: "Untitled group",
    typeFallback: "Henchmen",
    unnamed: "Unnamed Group",
    killsName: "henchmen group",
    empty: "No henchmen groups yet.",
    dismiss: "Disband",
    dismissConfirm: "Disband group",
    dismissVerb: "disband",
    draftNoun: "group",
    saveError: "Unable to save henchmen groups",
    unknownName: "Unknown Group",
    newUnit: "New Group",
    addNew: "Add new",
    formIdPrefix: "group",
  },
  flags: {
    hasSpells: false,
    hasMembers: true,
    hasTradeAction: false,
    canLead: false,
    supportsNoLevelUps: true,
    hasUpkeep: false,
    hasPendingAdvances: false,
    reportsMoveTarget: false,
    scrollsIntoViewOnExpand: false,
    savesWarbandHeader: false,
  },
  thresholdsKey: "henchmen_level_thresholds",
  advanceOptions: HENCHMEN_SELECTABLE_STATS,
  getLevelInfo: getHenchmenLevelInfo,
  showsXpBar: (group) => !group.no_level_ups,
  canLevelUp: (group) => !group.no_level_ups && Boolean(group.level_up),
  killCount: sumMemberKills,
  mapToForm: mapHenchmenGroupToForm,
  validate: validateHenchmenGroupForm,
  // The armour save as a number, like every kind (decision 11, BUG-87).
  buildPayload: (group, { isSessionCreated }) => ({
    name: group.name.trim() || null,
    unit_type: group.unit_type.trim() || null,
    race: group.race_id ?? null,
    price: toNullableNumber(group.price) ?? 0,
    xp: toNullableNumber(group.xp) ?? 0,
    max_size: toNullableNumber(group.max_size) ?? 5,
    deeds: group.deeds.trim() || null,
    armour_save: buildArmourSavePayload(group.armour_save),
    large: group.large,
    half_rate: group.half_rate,
    no_level_ups: group.no_level_ups,
    ...buildStatPayload(group),
    ...buildLevelUpPayload(group, isSessionCreated),
    items: computeItemsWithNewHenchmen(group),
    skill_ids: group.skills.map((skill) => skill.id),
    special_ids: group.specials.map((entry) => entry.id),
    henchmen: buildMembersPayload(group),
  }),
  buildXpPayload: (group, xp) => ({
    name: group.name,
    unit_type: group.unit_type,
    race: group.race_id ?? null,
    price: group.price,
    xp,
  }),
  levelUp: {
    selectableStats: HENCHMEN_SELECTABLE_STAT_SET,
    rollTable: {
      lines: [
        "2–4: +1 Initiative",
        "5: +1 Strength",
        "6–7: +1 WS or +1 BS",
        "8: +1 Attack",
        "9: +1 Leadership",
        "10–12: Lads Got Talent — one model becomes a Hero (re-roll if at Hero limit). Remaining group rolls again, re-rolling 10–12.",
      ],
      footnote: "All in the group gain the same advance. Max +1 per characteristic.",
      maxWidth: 260,
    },
    nameFallback: "Henchmen Group",
    useAdvance: useLadsGotTalentAdvance,
  },
  addForm: {
    actionsClassName: "flex flex-wrap items-center justify-end gap-2",
    buttonWrapperClassName: "space-y-1 scroll-mt-28",
  },
  slots: {
    SummaryHeader: HenchmenCardHeader,
    ExpandedTitle: HenchmenExpandedTitle,
    ExpandedTiles: HenchmenExpandedTiles,
    FormBasics: HenchmenFormBasics,
    FormLoadout: HenchmenFormLoadout,
  },
  editor: henchmenEditor,
};
