import { armourSaveToForm } from "../../../../units/unit-form-helpers";
import { HIRED_SWORD_TERMS } from "../../../../units/kinds/hireling-terms";
import { parseAvailableSkills } from "../../../../utils/warband-utils";

import type { HirelingProfileDetail } from "@/features/hirelings/types/hireling-catalogue-types";
import type { Item } from "@/features/items/types/item-types";
import type { Race } from "@/features/races/types/race-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { HeroCaster, NewHirelingForm } from "../../../../types/warband-types";

/** The add form filled from a hired sword of the catalogue, with its race when it has one. */
export function presetToNewHirelingForm(profile: HirelingProfileDetail, races: Race[]) {
  const entry = profile;
  const matchedRace = races.find((r) => r.id === profile.race_id) ?? null;
  const form: NewHirelingForm = {
    ...HIRED_SWORD_TERMS,
    name: entry.name,
    unit_type: entry.name,
    race_id: matchedRace?.id ?? null,
    race_name: matchedRace?.name ?? "",
    stats: {
      M: String(entry.movement),
      WS: String(entry.weapon_skill),
      BS: String(entry.ballistic_skill),
      S: String(entry.strength),
      T: String(entry.toughness),
      W: String(entry.wounds),
      I: String(entry.initiative),
      A: String(entry.attacks),
      Ld: String(entry.leadership),
    },
    price: String(profile.hire_cost ?? 0),
    upkeep_price: String(profile.upkeep_cost ?? 0),
    rating: String(profile.rating ?? 0),
    xp: "0",
    armour_save: armourSaveToForm(entry.armour_save),
    large: entry.large,
    caster: entry.caster as HeroCaster,
    half_rate: false,
    blood_pacted: false,
    available_skills: parseAvailableSkills(profile.available_skill_types),
    items: entry.equipment.map((eq) => eq.item as Item),
    skills: entry.skills as Skill[],
    spells: entry.spells as Spell[],
    specials: entry.specials as Special[],
  };
  return { form, raceQuery: matchedRace?.name ?? profile.race_label ?? "" };
}
