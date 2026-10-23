import { statInputs, statNumbers, type StatInputs } from "@/features/catalogue/utils/statblock";

import type { BeastKind } from "../bestiary-kinds";
import type {
  BestiaryAvailabilityWrite,
  BestiaryEntry,
  BestiaryEntryWrite,
} from "../types/bestiary-types";

export const CASTER_OPTIONS = ["No", "Wizard", "Priest"];

/** What a bestiary entry, a hired sword and a dramatis persona all hold, as their forms edit it. */
export type BestiaryCoreValues = {
  name: string;
  description: string;
  stats: StatInputs;
  armour_save: string;
  large: boolean;
  caster: string;
};

/** A new creature's starting line: every characteristic 0, but one wound and one attack. */
export const blankBestiaryCore = (): BestiaryCoreValues => ({
  name: "",
  description: "",
  stats: statInputs("0", { wounds: "1", attacks: "1" }),
  armour_save: "",
  large: false,
  caster: "No",
});

/** The entry's part of a create body: trimmed text, the stats as numbers, a whole-number save. */
export function bestiaryCorePayload(values: BestiaryCoreValues) {
  const armourSave = values.armour_save.trim();
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    ...statNumbers(values.stats),
    armour_save: armourSave ? parseInt(armourSave, 10) || null : null,
    large: values.large,
    caster: values.caster,
  };
}

/**
 * What the bestiary form edits: the beast's kind, profile and shop flag, a mount's rating bonus
 * (text, blank for none) and whether a creature gains experience. The item's prices are the shop
 * section's own rows.
 */
export type BestiaryEntryValues = BestiaryCoreValues & {
  kind: BeastKind;
  has_profile: boolean;
  gains_xp: boolean;
  rating_bonus: string;
  available_in_shop: boolean;
};

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** A beast's values as the form edits them; a blank one of `kind` for none. */
export function bestiaryValuesOf(
  entry: BestiaryEntry | null,
  kind: BeastKind = "creature"
): BestiaryEntryValues {
  if (!entry) {
    return {
      ...blankBestiaryCore(),
      kind,
      has_profile: true,
      gains_xp: false,
      rating_bonus: "",
      available_in_shop: false,
    };
  }
  return {
    kind: entry.kind,
    has_profile: entry.has_profile,
    gains_xp: entry.gains_xp,
    rating_bonus: text(entry.rating_bonus),
    available_in_shop: entry.available_in_shop,
    name: entry.name,
    description: entry.description ?? "",
    stats: statInputs("0", {
      movement: text(entry.movement),
      weapon_skill: text(entry.weapon_skill),
      ballistic_skill: text(entry.ballistic_skill),
      strength: text(entry.strength),
      toughness: text(entry.toughness),
      wounds: text(entry.wounds),
      initiative: text(entry.initiative),
      attacks: text(entry.attacks),
      leadership: text(entry.leadership),
    }),
    armour_save: text(entry.armour_save),
    large: Boolean(entry.large),
    caster: entry.caster || "No",
  };
}

type Links = Pick<BestiaryEntryWrite, "skill_ids" | "special_ids" | "spell_ids" | "item_entries">;

/**
 * The write body: the kind, the profile, the shop flag with the item's prices, and every link
 * list. A rating bonus is a mount's only and gaining experience a creature's only: another kind
 * sends none, so a beast whose kind changed keeps nothing hidden.
 */
export function bestiaryPayload(
  values: BestiaryEntryValues,
  links: Links,
  prices: BestiaryAvailabilityWrite[]
): BestiaryEntryWrite {
  const bonus = values.rating_bonus.trim();
  return {
    kind: values.kind,
    ...bestiaryCorePayload(values),
    has_profile: values.has_profile,
    gains_xp: values.kind === "creature" && values.gains_xp,
    rating_bonus: values.kind === "mount" && bonus ? Number(bonus) : null,
    available_in_shop: values.available_in_shop,
    item: { availabilities: prices },
    ...links,
  };
}
