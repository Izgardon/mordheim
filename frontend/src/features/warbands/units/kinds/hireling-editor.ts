import HirelingAddFields from "../../components/units/kinds/hireling/HirelingAddFields";
import { buildPendingChanges } from "../../utils/pending-purchases";
import { toNullableNumber } from "../../utils/warband-utils";
import {
  appendSkill,
  blankStats,
  copyBasics,
  isSet,
  nextDraftKey,
  noSkillAccess,
  useNoFormExtras,
} from "./editor-helpers";
import { HIRED_SWORD_TERMS, isDramatisPersona, takesHiredSwordPlace } from "./hireling-terms";

import type { UnitEditorConfig } from "../unit-kind-types";

/**
 * Hired swords and dramatis personae: the hired-sword cap counts hired swords without a blood pact
 * (dramatis personae sit outside it) and ignores the warband unit limit; the add form's kind,
 * terms, blood pact and loadout go into the queued recruit.
 */
export const hirelingEditor: UnitEditorConfig<"hireling"> = {
  creation: {
    initialForm: {
      ...HIRED_SWORD_TERMS,
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
    // A hireling may have no race: one hired from an entry whose race the catalogue lacks.
    optionalRace: true,
    toFormEntry: (form, name, unitType) => ({
      draftKey: nextDraftKey("hirelings"),
      name,
      unit_type: unitType,
      kind: form.kind,
      injury_table: form.injury_table,
      stays: form.stays,
      payment_note: form.payment_note,
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
      // A dramatis persona never gains experience.
      no_level_ups: isDramatisPersona(form),
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
          form.payment_note.trim() ||
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
    recruitCost: (form) => toNullableNumber(form.price) ?? 0,
    duplicate: (form) => copyBasics(form, "hirelings"),
  },
  // At the cap the add form still opens: a blood-pacted hired sword (decision 12) and a dramatis
  // persona don't count, so only "Create" is refused, and only for one that would (BUG-102).
  limits: ({ forms, isEditing, newForm, roster }) => {
    const count = isEditing ? forms.filter(takesHiredSwordPlace).length : roster.hirelingCount;
    const isAtCap = count >= roster.maxHiredSwords;
    const isHirelingLimitReached = isAtCap && takesHiredSwordPlace(newForm);
    return {
      titleSuffix: `[${count}/${roster.maxHiredSwords}]`,
      isCreateBlocked: isHirelingLimitReached,
      isAddDisabled: false,
      addButtonNotice: isAtCap
        ? `Maximum of ${roster.maxHiredSwords} hired swords reached; a blood-pacted one or a dramatis persona can still join.`
        : undefined,
      addFormNotices: isHirelingLimitReached
        ? [
            `Maximum of ${roster.maxHiredSwords} hired swords reached. Tick Bloodpacted, or add a dramatis persona, for one that doesn't count.`,
          ]
        : [],
      // A blood-pacted copy (decision 12) or a dramatis persona doesn't count towards the cap.
      duplicateBlockedReason: (form) =>
        isAtCap && takesHiredSwordPlace(form)
          ? `Maximum of ${roster.maxHiredSwords} hired swords reached.`
          : null,
    };
  },
  buildPendingChanges: (purchases) => buildPendingChanges(purchases),
  useFormExtras: useNoFormExtras,
  addCreatedSkill: appendSkill,
  AddFields: HirelingAddFields,
};
