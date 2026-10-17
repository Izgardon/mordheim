import { getHenchmenLevelInfo } from "../../components/henchmen/utils/henchmen-level";
import { HENCHMEN_SELECTABLE_STATS } from "../../utils/levelup-utils";
import { toNullableNumber } from "../../utils/warband-utils";
import {
  buildStatPayload,
  mapStatsToForm,
  missingIdentityFields,
  toValidationError,
} from "../unit-form-helpers";
import { buildMembersPayload, computeItemsWithNewHenchmen } from "./henchmen-members";

import type { HenchmenGroup, HenchmenGroupFormEntry } from "../../types/warband-types";
import type { UnitKindConfig } from "../unit-kind-types";

/** No caster, spells or skill access; the group size defaults to 5. */
export const mapHenchmenGroupToForm = (group: HenchmenGroup): HenchmenGroupFormEntry => ({
  id: group.id,
  name: group.name ?? "",
  unit_type: group.unit_type ?? "",
  race_id: group.race_id ?? null,
  race_name: group.race_name ?? "",
  race: group.race ?? null,
  stats: mapStatsToForm(group),
  xp: group.xp?.toString() ?? "0",
  max_size: group.max_size?.toString() ?? "5",
  price: group.price?.toString() ?? "0",
  armour_save: group.armour_save != null ? String(group.armour_save) : "",
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
    loadingDetails: "Loading group details...",
    detailError: "Failed to load group details",
    killsName: "henchmen group",
    empty: "No henchmen groups yet.",
    dismiss: "Disband",
    dismissConfirm: "Disband group",
    dismissVerb: "disband",
  },
  flags: {
    hasSpells: false,
    hasMembers: true,
    hasTradeAction: false,
    canLead: false,
    supportsNoLevelUps: true,
    hasUpkeep: false,
    xpBarHalfRate: false,
    reportsMoveTarget: false,
    scrollsIntoViewOnExpand: false,
  },
  thresholdsKey: "henchmen_level_thresholds",
  advanceOptions: HENCHMEN_SELECTABLE_STATS,
  getLevelInfo: getHenchmenLevelInfo,
  hasDetail: (group) => group.race !== undefined || group.deeds !== undefined,
  showsXpBar: (group) => !group.no_level_ups,
  canLevelUp: (group) => !group.no_level_ups && Boolean(group.level_up),
  mapToForm: mapHenchmenGroupToForm,
  validate: validateHenchmenGroupForm,
  // Armour save stays the typed string (BUG-87).
  buildPayload: (group, { isSessionCreated }) => ({
    name: group.name.trim() || null,
    unit_type: group.unit_type.trim() || null,
    race: group.race_id ?? null,
    price: toNullableNumber(group.price) ?? 0,
    xp: toNullableNumber(group.xp) ?? 0,
    max_size: toNullableNumber(group.max_size) ?? 5,
    deeds: group.deeds.trim() || null,
    armour_save: group.armour_save.trim() || null,
    large: group.large,
    half_rate: group.half_rate,
    no_level_ups: group.no_level_ups,
    ...buildStatPayload(group),
    ...(isSessionCreated ? { level_up: 0 } : {}),
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
};
