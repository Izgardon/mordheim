import type { SkillGroup } from "./types/skill-types";

type Learning = Pick<SkillGroup, "large_only" | "learn_note"> | null | undefined;

/** What a skill group says about who learns from it: "Large units only" and its note ("Vampire only"). */
export const learningNotes = (group: Learning) =>
  [group?.large_only ? "Large units only" : "", group?.learn_note ?? ""].filter(Boolean);

/**
 * The warning for picking a skill through a Large unit's group for a unit that isn't Large (the
 * fees and skill lists step): shown greyed with this, and still pickable (a guide, not a gatekeeper).
 */
export const largeWarning = (group: Learning, unitIsLarge: boolean | null | undefined) =>
  group?.large_only && !unitIsLarge ? "For Large units only; this one isn't Large." : "";
