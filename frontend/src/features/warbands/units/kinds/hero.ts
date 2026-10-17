import { getHeroLevelInfo } from "../../components/heroes/utils/hero-level";
import { HERO_SELECTABLE_STATS, OTHER_OPTIONS } from "../../utils/levelup-utils";
import {
  buildAvailableSkillsPayload,
  parseAvailableSkills,
  toNullableNumber,
} from "../../utils/warband-utils";
import {
  buildStatPayload,
  mapStatsToForm,
  missingIdentityFields,
  normalizeCaster,
  toItemEntries,
  toValidationError,
} from "../unit-form-helpers";

import type { HeroFormEntry, WarbandHero } from "../../types/warband-types";
import type { UnitKindConfig } from "../unit-kind-types";

export const mapHeroToForm = (hero: WarbandHero): HeroFormEntry => ({
  id: hero.id,
  name: hero.name ?? "",
  unit_type: hero.unit_type ?? "",
  race_id: hero.race_id ?? null,
  race_name: hero.race_name ?? "",
  race: hero.race ?? null,
  stats: mapStatsToForm(hero),
  xp: hero.xp?.toString() ?? "0",
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

export const heroKind: UnitKindConfig<"hero"> = {
  key: "hero",
  section: "heroes",
  labels: {
    plural: "Heroes",
    singular: "Hero",
    edit: "Edit Heroes",
    add: "Add hero",
    create: "Create hero",
    fallbackName: (index) => `Hero ${index + 1}`,
    untitled: "Untitled hero",
    typeFallback: "Hero",
    unnamed: "Unnamed Hero",
    loadingDetails: "Loading hero details...",
    detailError: "Failed to load hero details",
    killsName: "hero",
    empty: "No heroes logged yet. Start with your leader.",
    dismiss: "Dismiss",
    dismissConfirm: "Dismiss hero",
    dismissVerb: "dismiss",
  },
  flags: {
    hasSpells: true,
    hasMembers: false,
    hasTradeAction: true,
    canLead: true,
    supportsNoLevelUps: false,
    hasUpkeep: false,
    xpBarHalfRate: true,
    reportsMoveTarget: true,
    scrollsIntoViewOnExpand: false,
  },
  thresholdsKey: "hero_level_thresholds",
  advanceOptions: [...HERO_SELECTABLE_STATS, ...OTHER_OPTIONS.map((option) => option.id)],
  getLevelInfo: getHeroLevelInfo,
  hasDetail: (hero) =>
    hero.race !== undefined ||
    hero.deeds !== undefined ||
    hero.kills !== undefined ||
    hero.dead !== undefined,
  showsXpBar: () => true,
  canLevelUp: (hero) => Boolean(hero.level_up),
  mapToForm: mapHeroToForm,
  validate: validateHeroForm,
  // No level_up for a hero created this session (BUG-65); armour save as a number (BUG-87).
  buildPayload: (hero) => ({
    name: hero.name.trim() || null,
    unit_type: hero.unit_type.trim() || null,
    race: hero.race_id ?? null,
    price: toNullableNumber(hero.price) ?? 0,
    xp: toNullableNumber(hero.xp) ?? 0,
    deeds: hero.deeds.trim() || null,
    is_leader: hero.is_leader,
    trading_action: hero.trading_action,
    armour_save: Number(hero.armour_save.trim()) || null,
    large: hero.large,
    caster: hero.caster,
    half_rate: hero.half_rate,
    available_skills: buildAvailableSkillsPayload(hero.available_skills),
    ...buildStatPayload(hero),
    ...buildLoadoutPayload(hero),
  }),
  buildXpPayload: (hero, xp) => ({
    name: hero.name,
    unit_type: hero.unit_type,
    race: hero.race_id ?? null,
    price: hero.price,
    xp,
    is_leader: hero.is_leader ?? false,
  }),
};
