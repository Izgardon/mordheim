import { isPendingByType } from "../../components/heroes/utils/pending-entries";
import { skillFields, statFields } from "../../utils/warband-utils";

import type { Skill } from "@/features/skills/types/skill-types";

export const blankStats = (): Record<string, string> =>
  statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {});

export const noSkillAccess = (): Record<string, boolean> =>
  skillFields.reduce((acc, field) => ({ ...acc, [field.key]: false }), {});

/** A typed value other than blank or 0. */
export const isSet = (value: string, empty = "0") =>
  Boolean(value.trim() && value.trim() !== empty);

/** Most kinds append a skill made from the edit card. */
export const appendSkill = <F extends { skills: Skill[] }>(form: F, skill: Skill): F => ({
  ...form,
  skills: [...form.skills, skill],
});

/** Heroes drop their first pending "New Skill" placeholder for the new skill. */
export const replacePendingSkill = <F extends { skills: Skill[] }>(form: F, skill: Skill): F => {
  const pendingIdx = form.skills.findIndex((s) => isPendingByType(s));
  const cleaned = pendingIdx !== -1 ? form.skills.filter((_, i) => i !== pendingIdx) : form.skills;
  return { ...form, skills: [...cleaned, skill] };
};

/** Kinds whose edit cards need nothing beyond the section's props. */
export function useNoFormExtras() {
  return { cardProps: {} };
}
