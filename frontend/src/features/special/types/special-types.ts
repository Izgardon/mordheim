import type { SpecialKind } from "@/components/ui/game-icons";
import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

export type Special = CatalogueBadgeFields & {
  id: number;
  name: string;
  type?: string | null;
  /** Boons & Banes: boon, bane or trait. */
  kind?: SpecialKind;
  description?: string | null;
  campaign_id?: number | null;
};
