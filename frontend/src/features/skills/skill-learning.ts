import type { Skill } from "./types/skill-types";

type Learning = Pick<Skill, "large_only" | "learn_note">;

/** What a skill says about who learns it: "Large units only" and its note ("Vampire only"). */
export const learningNotes = (skill: Learning) =>
  [skill.large_only ? "Large units only" : "", skill.learn_note ?? ""].filter(Boolean);

/**
 * The warning for picking a Large unit's skill for a unit that isn't Large (the fees and skill
 * lists step): shown greyed with this, and still pickable (a guide, not a gatekeeper).
 */
export const largeWarning = (skill: Learning, unitIsLarge: boolean | null | undefined) =>
  skill.large_only && !unitIsLarge ? "For Large units only; this one isn't Large." : "";
