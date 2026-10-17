import { parseAvailableSkills } from "../../utils/warband-utils";
import {
  mapLevelUpToForm,
  mapStatsToForm,
  missingIdentityFields,
  normalizeCaster,
  toItemEntries,
  toValidationError,
} from "../unit-form-helpers";

import type { HeroFormEntry, WarbandHero } from "../../types/warband-types";

export const mapHeroToForm = (hero: WarbandHero): HeroFormEntry => ({
  id: hero.id,
  name: hero.name ?? "",
  unit_type: hero.unit_type ?? "",
  race_id: hero.race_id ?? null,
  race_name: hero.race_name ?? "",
  race: hero.race ?? null,
  stats: mapStatsToForm(hero),
  xp: hero.xp?.toString() ?? "0",
  ...mapLevelUpToForm(hero),
  price: hero.price?.toString() ?? "0",
  armour_save: hero.armour_save != null ? String(hero.armour_save) : "",
  deeds: hero.deeds ?? "",
  is_leader: Boolean(hero.is_leader),
  trading_action: Boolean(hero.trading_action),
  large: Boolean(hero.large),
  caster: normalizeCaster(hero.caster),
  half_rate: Boolean(hero.half_rate),
  available_skills: parseAvailableSkills(hero.available_skills),
  items: hero.items ?? [],
  skills: hero.skills ?? [],
  spells: hero.spells ?? [],
  specials: hero.specials ?? [],
});

/** Name, type and race; hired swords validate exactly the same way. */
export const validateHeroForm = (hero: HeroFormEntry) =>
  toValidationError(missingIdentityFields(hero));

/** The hero and hired-sword loadout lists, as the PATCH sends them. */
export const buildLoadoutPayload = (form: HeroFormEntry) => ({
  items: toItemEntries(form.items),
  skill_ids: form.skills.map((skill) => skill.id),
  special_ids: form.specials.map((entry) => entry.id),
  spell_ids: form.spells.map((spell) => spell.id),
});
