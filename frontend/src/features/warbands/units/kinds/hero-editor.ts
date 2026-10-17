import HeroAddFields from "../../components/units/kinds/hero/HeroAddFields";
import { buildPendingChanges } from "../../utils/pending-purchases";
import { toNullableNumber } from "../../utils/warband-utils";
import { buildStatPayload } from "../unit-form-helpers";
import { mapHeroToForm } from "./hero-forms";
import {
  blankStats,
  isSet,
  noSkillAccess,
  replacePendingSkill,
  useNoFormExtras,
} from "./editor-helpers";

import type { UnitEditorConfig } from "../unit-kind-types";

/** Heroes: the hero cap and the warband unit limit; "Create hero" POSTs at once. */
export const heroEditor: UnitEditorConfig<"hero"> = {
  creation: {
    initialForm: {
      name: "",
      unit_type: "",
      race_id: null,
      race_name: "",
      price: "0",
      xp: "0",
      is_leader: false,
    },
    blockedError: "Hero limit reached.",
    failureError: "Failed to create hero.",
    toFormEntry: (form, name, unitType) => ({
      name,
      unit_type: unitType,
      race_id: form.race_id,
      race_name: form.race_name,
      stats: blankStats(),
      xp: form.xp.trim() || "0",
      price: form.price.trim() || "0",
      armour_save: "",
      deeds: "",
      is_leader: form.is_leader,
      trading_action: true,
      large: false,
      caster: "No",
      half_rate: false,
      available_skills: noSkillAccess(),
      items: [],
      skills: [],
      spells: [],
      specials: [],
    }),
    isDraftDirty: (form, raceQuery) =>
      Boolean(
        form.name.trim() ||
          form.unit_type.trim() ||
          raceQuery.trim() ||
          isSet(form.price) ||
          isSet(form.xp)
      ),
    // level_up 0 like the other kinds (BUG-65); skill access as the checkbox dict (BUG-101).
    buildPayload: (entry) => ({
      name: entry.name.trim() || null,
      unit_type: entry.unit_type.trim() || null,
      race: entry.race_id ?? null,
      price: toNullableNumber(entry.price) ?? 0,
      xp: toNullableNumber(entry.xp) ?? 0,
      level_up: 0,
      deeds: null,
      is_leader: entry.is_leader,
      armour_save: null,
      large: entry.large,
      caster: entry.caster,
      half_rate: entry.half_rate,
      available_skills: entry.available_skills,
      ...buildStatPayload(entry),
      items: [],
      skill_ids: [],
      special_ids: [],
      spell_ids: [],
    }),
    formAfterCreate: (_entry, created) => mapHeroToForm(created),
  },
  limits: ({ units, forms, isEditing, roster }) => {
    const heroCount = isEditing ? forms.length : units.length;
    const isHeroLimitReached = forms.length >= roster.maxHeroes;
    const isUnitLimitReached =
      heroCount + roster.henchmanCount + roster.bloodPactedCount >= roster.maxUnits;
    return {
      titleSuffix: `[${heroCount}/${roster.maxHeroes}]`,
      isCreateBlocked: isHeroLimitReached,
      isAddDisabled: isHeroLimitReached || isUnitLimitReached,
      addFormNotices: [
        ...(isHeroLimitReached ? [`Maximum of ${roster.maxHeroes} heroes reached.`] : []),
        ...(isUnitLimitReached && !isHeroLimitReached
          ? [`Warband unit limit of ${roster.maxUnits} reached.`]
          : []),
      ],
      isUnitLimitReached,
    };
  },
  buildPendingChanges: (purchases) => buildPendingChanges(purchases),
  useFormExtras: useNoFormExtras,
  addCreatedSkill: replacePendingSkill,
  AddFields: HeroAddFields,
};
