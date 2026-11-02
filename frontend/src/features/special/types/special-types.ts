import type { SpecialKind } from "@/components/ui/game-icons";
import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

/**
 * Whose rule it is: a hired sword's or dramatis persona's own (shown only with them) or a general
 * one, which the Boons & Banes pickers offer.
 */
export type SpecialOwnerKind = "general" | "hired_sword" | "dramatis_persona";

export type Special = CatalogueBadgeFields & {
  id: number;
  name: string;
  type?: string | null;
  /** Boons & Banes: boon, bane or trait. */
  kind?: SpecialKind;
  owner_kind?: SpecialOwnerKind;
  description?: string | null;
  campaign_id?: number | null;
};
