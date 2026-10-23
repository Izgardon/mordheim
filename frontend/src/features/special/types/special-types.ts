import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

export type Special = CatalogueBadgeFields & {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
  campaign_id?: number | null;
};
