import { statInputs, statNumbers, type StatInputs } from "@/features/catalogue/utils/statblock";

export const BESTIARY_TYPES = ["Attack", "Mount", "Retainer"];
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
