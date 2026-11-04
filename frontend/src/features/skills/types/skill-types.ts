import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";
import type { AccessLine, AccessLineInput } from "@/features/items/types/item-types";

/** A skill: its name and rules. The groups holding it list it (`SkillGroup.skill_ids`). */
export type Skill = CatalogueBadgeFields & {
  id: number;
  campaign_id?: number | null;
  name: string;
  description: string;
};

export type SkillCreatePayload = {
  name: string;
  description: string;
  /** The campaign's groups that hold it (a book group's change makes the campaign's version). */
  group_ids?: number[];
  campaign_id: number;
};

export type SkillUpdatePayload = {
  /** A book skill's edit: the campaign whose version it makes or changes. */
  campaign_id?: number;
  name?: string;
  description?: string;
  group_ids?: number[];
};

/**
 * A skill group (skill groups, phase 1a): who learns from it, whether it is a Large unit's (any
 * other unit warns, never blocks) and the note shown when learning from it ("Vampire only"), and
 * its skills as the campaign's current entries.
 */
export type SkillGroup = CatalogueBadgeFields & {
  id: number;
  campaign_id?: number | null;
  name: string;
  /** What a unit's skill access names it by: the book group's name for a version of it. */
  access_name: string;
  for_everyone: boolean;
  warbands: AccessLine[];
  large_only: boolean;
  learn_note: string;
  skill_ids: number[];
};

export type SkillGroupPayload = {
  campaign_id?: number;
  name?: string;
  for_everyone?: boolean;
  warbands?: AccessLineInput[];
  large_only?: boolean;
  learn_note?: string;
  skill_ids?: number[];
};
