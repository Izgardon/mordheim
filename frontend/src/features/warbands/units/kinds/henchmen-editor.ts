import { removeWarbandItem } from "../../api/warbands-items";
import HenchmenAddFields from "../../components/units/kinds/henchmen/HenchmenAddFields";
import { useHenchmenStash } from "../../components/units/kinds/henchmen/useHenchmenStash";
import { buildHenchmenPendingChanges } from "../../utils/pending-purchases";
import { toNullableNumber } from "../../utils/warband-utils";
import { buildStatPayload } from "../unit-form-helpers";
import { appendSkill, blankStats, isSet } from "./editor-helpers";
import { collectStashRemovals } from "./henchmen-members";

import type { UnitEditorConfig } from "../unit-kind-types";

/** Henchmen: the warband unit limit only; a group is created with its first member. */
export const henchmenEditor: UnitEditorConfig<"henchmen_group"> = {
  creation: {
    initialForm: {
      name: "",
      unit_type: "",
      race_id: null,
      race_name: "",
      price: "0",
      xp: "0",
      max_size: "5",
      firstHenchmanName: "",
    },
    blockedError: "",
    failureError: "Failed to create group.",
    extraError: (form) =>
      form.firstHenchmanName.trim() ? null : "First henchman name is required.",
    toFormEntry: (form, name, unitType) => ({
      name,
      unit_type: unitType,
      race_id: form.race_id,
      race_name: form.race_name,
      stats: blankStats(),
      xp: form.xp.trim() || "0",
      max_size: form.max_size.trim() || "5",
      price: form.price.trim() || "0",
      armour_save: "",
      deeds: "",
      large: false,
      half_rate: false,
      no_level_ups: false,
      items: [],
      skills: [],
      specials: [],
      henchmen: [{ id: 0, name: form.firstHenchmanName.trim(), kills: 0, dead: false }],
    }),
    isDraftDirty: (form, raceQuery) =>
      Boolean(
        form.name.trim() ||
          form.unit_type.trim() ||
          raceQuery.trim() ||
          form.firstHenchmanName.trim() ||
          isSet(form.price) ||
          isSet(form.xp) ||
          isSet(form.max_size, "5")
      ),
    buildPayload: (entry) => ({
      name: entry.name.trim() || null,
      unit_type: entry.unit_type.trim() || null,
      race: entry.race_id ?? null,
      price: toNullableNumber(entry.price) ?? 0,
      xp: toNullableNumber(entry.xp) ?? 0,
      level_up: 0,
      max_size: toNullableNumber(entry.max_size) ?? 5,
      deeds: null,
      armour_save: null,
      large: entry.large,
      half_rate: entry.half_rate,
      no_level_ups: entry.no_level_ups,
      ...buildStatPayload(entry),
      items: [],
      skill_ids: [],
      special_ids: [],
      henchmen: entry.henchmen.map((h) => ({
        ...(h.id ? { id: h.id } : {}),
        name: h.name,
        kills: h.kills,
        dead: h.dead,
      })),
    }),
    // The form keeps the server's member ids.
    formAfterCreate: (entry, created) => ({
      ...entry,
      id: created.id,
      henchmen: created.henchmen.map((h) => ({
        id: h.id,
        name: h.name,
        kills: h.kills,
        dead: h.dead,
      })),
    }),
  },
  limits: ({ units, forms, isEditing, roster }) => {
    const henchmenCount = (isEditing ? forms : units).reduce(
      (total, group) => total + (group.henchmen?.length ?? 0),
      0
    );
    const isUnitLimitReached =
      henchmenCount + roster.heroCount + roster.bloodPactedCount >= roster.maxUnits;
    return {
      titleSuffix: `[${henchmenCount}]`,
      isCreateBlocked: false,
      isAddDisabled: isUnitLimitReached,
      addButtonNotice: isUnitLimitReached
        ? `Warband unit limit of ${roster.maxUnits} reached.`
        : undefined,
      addFormNotices: [],
      isUnitLimitReached,
    };
  },
  buildPendingChanges: buildHenchmenPendingChanges,
  afterSaveWrites: async (warbandId, forms) => {
    // Items taken "from stash" in the add-henchman dialog leave the stash after the writes.
    const removals = collectStashRemovals(forms);
    for (const { itemId, quantity } of removals) {
      await removeWarbandItem(warbandId, itemId, quantity);
    }
    return removals.length;
  },
  useFormExtras: useHenchmenStash,
  addCreatedSkill: appendSkill,
  AddFields: HenchmenAddFields,
};
