import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

export type Skill = CatalogueBadgeFields & {
  id: number;
  campaign_id?: number | null;
  name: string;
  type: string;
  description: string;
  /** A Large unit's skill: picking it for another unit warns, never blocks. */
  large_only?: boolean;
  /** Shown when learning it, never checked ("Vampire only"). */
  learn_note?: string;
};

export type SkillCreatePayload = {
  name: string;
  type: string;
  description: string;
  large_only?: boolean;
  learn_note?: string;
  campaign_id: number;
};

export type SkillUpdatePayload = {
  /** A book skill's edit: the campaign whose version it makes or changes. */
  campaign_id?: number;
  name?: string;
  type?: string;
  description?: string;
  large_only?: boolean;
  learn_note?: string;
};
