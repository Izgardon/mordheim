import HiredSwordAddFields from "../../components/units/kinds/hired-sword/HiredSwordAddFields";
import { buildPendingChanges } from "../../utils/pending-purchases";
import { buildAvailableSkillsPayload, toNullableNumber } from "../../utils/warband-utils";
import { buildStatPayload } from "../unit-form-helpers";
import { appendSkill, blankStats, isSet, noSkillAccess, useNoFormExtras } from "./editor-helpers";

import type { UnitEditorConfig } from "../unit-kind-types";

const notBloodPacted = (entry: { blood_pacted?: boolean | null }) => !entry.blood_pacted;

/**
 * Hired swords: the hired-sword cap counts those without a blood pact and ignores the warband
 * unit limit; the add form's preset, blood pact and loadout go into the POST.
 */
export const hiredSwordEditor: UnitEditorConfig<"hired_sword"> = {
  creation: {
    initialForm: {
      name: "",
      unit_type: "",
      race_id: null,
      race_name: "",
      stats: blankStats(),
      price: "0",
      upkeep_price: "0",
      rating: "0",
      xp: "0",
      armour_save: "",
      large: false,
      caster: "No",
      half_rate: false,
      blood_pacted: false,
      available_skills: noSkillAccess(),
      items: [],
      skills: [],
      spells: [],
      specials: [],
    },
    blockedError: "Hired sword limit reached.",
    failureError: "Failed to create hired sword.",
    toFormEntry: (form, name, unitType) => ({
      name,
      unit_type: unitType,
      race_id: form.race_id,
      race_name: form.race_name,
      stats: form.stats,
      xp: form.xp.trim() || "0",
      price: form.price.trim() || "0",
      upkeep_price: form.upkeep_price.trim() || "0",
      rating: form.rating.trim() || "0",
      armour_save: form.armour_save,
      deeds: "",
      is_leader: false,
      trading_action: false,
      caster: form.caster,
      large: form.large,
      half_rate: form.half_rate,
      blood_pacted: form.blood_pacted,
      no_level_ups: false,
      available_skills: form.available_skills,
      items: form.items,
      skills: form.skills,
      spells: form.spells,
      specials: form.specials,
    }),
    isDraftDirty: (form, raceQuery) =>
      Boolean(
        form.name.trim() ||
          form.unit_type.trim() ||
          raceQuery.trim() ||
          isSet(form.price) ||
          isSet(form.upkeep_price) ||
          isSet(form.rating) ||
          isSet(form.xp) ||
          form.items.length > 0 ||
          form.skills.length > 0 ||
          form.spells.length > 0 ||
          form.specials.length > 0
      ),
    // The add form's armour save (a preset's included: BUG-100) and skill access as the list
    // Save sends (BUG-101).
    buildPayload: (entry) => ({
      name: entry.name.trim() || null,
      unit_type: entry.unit_type.trim() || null,
      race: entry.race_id ?? null,
      price: toNullableNumber(entry.price) ?? 0,
      upkeep_price: toNullableNumber(entry.upkeep_price) ?? 0,
      rating: toNullableNumber(entry.rating) ?? 0,
      xp: toNullableNumber(entry.xp) ?? 0,
      level_up: 0,
      deeds: null,
      armour_save: toNullableNumber(entry.armour_save),
      large: entry.large,
      caster: entry.caster,
      half_rate: entry.half_rate,
      no_level_ups: entry.no_level_ups,
      blood_pacted: entry.blood_pacted,
      available_skills: buildAvailableSkillsPayload(entry.available_skills),
      ...buildStatPayload(entry),
      items: entry.items.map((item) => ({ id: item.id, cost: item.cost ?? null })),
      skill_ids: entry.skills.map((skill) => skill.id),
      special_ids: entry.specials?.map((s) => s.id) ?? [],
      spell_ids: entry.spells.map((spell) => spell.id),
    }),
    // The form is the add form's entry, not the server copy.
    formAfterCreate: (entry, created) => ({ ...entry, id: created.id }),
  },
  // At the cap the add form still opens: a blood-pacted hired sword doesn't count (decision 12),
  // so only "Create" is refused, and only for one without a blood pact (BUG-102).
  limits: ({ units, forms, isEditing, newForm, roster }) => {
    const isAtCap = forms.filter(notBloodPacted).length >= roster.maxHiredSwords;
    const isHiredSwordLimitReached = isAtCap && !newForm.blood_pacted;
    const count = (isEditing ? forms : units).filter(notBloodPacted).length;
    return {
      titleSuffix: `[${count}/${roster.maxHiredSwords}]`,
      isCreateBlocked: isHiredSwordLimitReached,
      isAddDisabled: false,
      addButtonNotice: isAtCap
        ? `Maximum of ${roster.maxHiredSwords} hired swords reached; a blood-pacted one can still join.`
        : undefined,
      addFormNotices: isHiredSwordLimitReached
        ? [
            `Maximum of ${roster.maxHiredSwords} hired swords reached. Tick Bloodpacted to add one that doesn't count.`,
          ]
        : [],
      isUnitLimitReached: false,
    };
  },
  buildPendingChanges: (purchases) => buildPendingChanges(purchases),
  useFormExtras: useNoFormExtras,
  addCreatedSkill: appendSkill,
  AddFields: HiredSwordAddFields,
};
