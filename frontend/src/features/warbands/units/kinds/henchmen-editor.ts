import { removeWarbandItem } from "../../api/warbands-items";
import HenchmenAddFields from "../../components/units/kinds/henchmen/HenchmenAddFields";
import { useHenchmenStash } from "../../components/units/kinds/henchmen/useHenchmenStash";
import { buildHenchmenPendingChanges } from "../../utils/pending-purchases";
import { toNullableNumber } from "../../utils/warband-utils";
import { appendSkill, blankStats, copyBasics, isSet, nextDraftKey } from "./editor-helpers";
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
    extraError: (form) =>
      form.firstHenchmanName.trim() ? null : "First henchman name is required.",
    toFormEntry: (form, name, unitType) => ({
      draftKey: nextDraftKey("henchmen"),
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
    // A new group pays its price for each member.
    recruitCost: (form) => (toNullableNumber(form.price) ?? 0) * form.henchmen.length,
    // The copy recruits the same living members (new, without kills).
    duplicate: (form) => ({
      ...copyBasics(form, "henchmen"),
      henchmen: form.henchmen
        .filter((member) => !member.dead)
        .map((member) => ({ id: 0, name: member.name, kills: 0, dead: false })),
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
      duplicateBlockedReason: () =>
        isUnitLimitReached ? `Warband unit limit of ${roster.maxUnits} reached.` : null,
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
