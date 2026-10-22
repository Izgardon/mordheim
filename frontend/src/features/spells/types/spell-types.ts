import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

export type Spell = CatalogueBadgeFields & {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
  dc?: string | number | null;
  roll?: number | null;
  campaign_id?: number | null;
};
