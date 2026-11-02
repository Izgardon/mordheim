import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

export type Spell = CatalogueBadgeFields & {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
  dc?: string | number | null;
  roll?: number | null;
  campaign_id?: number | null;
  /** A unit's spell only: how much easier it is for him (-1 each time he rolled it again). */
  dc_change?: number;
};
