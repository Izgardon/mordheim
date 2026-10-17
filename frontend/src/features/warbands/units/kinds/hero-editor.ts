import HeroAddFields from "../../components/units/kinds/hero/HeroAddFields";
import { buildPendingChanges } from "../../utils/pending-purchases";
import { toNullableNumber } from "../../utils/warband-utils";
import {
  blankStats,
  copyBasics,
  isSet,
  nextDraftKey,
  noSkillAccess,
  replacePendingSkill,
  useNoFormExtras,
} from "./editor-helpers";

import type { UnitEditorConfig } from "../unit-kind-types";

/** Heroes: the hero cap and the warband unit limit; a new hero is queued until Save. */
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
    toFormEntry: (form, name, unitType) => ({
      draftKey: nextDraftKey("heroes"),
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
    recruitCost: (form) => toNullableNumber(form.price) ?? 0,
    duplicate: (form) => ({
      ...copyBasics(form, "heroes"),
      is_leader: false,
      trading_action: true,
    }),
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
      duplicateBlockedReason: () =>
        isHeroLimitReached ? `Maximum of ${roster.maxHeroes} heroes reached.` : null,
    };
  },
  buildPendingChanges: (purchases) => buildPendingChanges(purchases),
  useFormExtras: useNoFormExtras,
  addCreatedSkill: replacePendingSkill,
  AddFields: HeroAddFields,
};
