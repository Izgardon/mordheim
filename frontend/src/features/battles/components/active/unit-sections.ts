/**
 * The order a battle's unit pickers list their sections in (the kill dialog, the melee and ranged
 * helpers): pets with a profile fight as their own models (step 5) after the hired swords.
 */
export const UNIT_SECTION_ORDER: readonly string[] = [
  "Heroes",
  "Henchmen",
  "Hired Swords",
  "Pets",
  "Temporary Units",
];

/** A picker's options in their sections, in that order; empty sections are left out. */
export const groupOptionsBySection = <T extends { sectionLabel: string }>(options: T[]) =>
  UNIT_SECTION_ORDER.map((sectionLabel) => ({
    sectionLabel,
    options: options.filter((option) => option.sectionLabel === sectionLabel),
  })).filter((group) => group.options.length > 0);
