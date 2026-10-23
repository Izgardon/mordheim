import { statInputs, statNumbers, type StatInputs } from "@/features/catalogue/utils/statblock";

import type { BeastKind } from "../bestiary-kinds";
import type { BestiaryEntry, BestiaryEntryWrite } from "../types/bestiary-types";

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

/** What the bestiary form edits: the beast's kind and its profile. */
export type BestiaryEntryValues = BestiaryCoreValues & { kind: BeastKind };

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** A beast's values as the form edits them; a blank one of `kind` for none. */
export function bestiaryValuesOf(
  entry: BestiaryEntry | null,
  kind: BeastKind = "creature"
): BestiaryEntryValues {
  if (!entry) {
    return { ...blankBestiaryCore(), kind };
  }
  return {
    kind: entry.kind,
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

/** The write body: the kind, the profile and every link list. */
export function bestiaryPayload(values: BestiaryEntryValues, links: Links): BestiaryEntryWrite {
  return {
    kind: values.kind,
    ...bestiaryCorePayload(values),
    ...links,
  };
}
