import type { SpecialCategory, SpecialKind } from "@/components/ui/game-icons";
import type { CatalogueBadgeFields } from "@/features/catalogue/types/catalogue-entry";

/**
 * Whose rule it is: a hired sword's or dramatis persona's own (shown only with them) or a general
 * one, which the Boons & Banes pickers offer.
 */
export type SpecialOwnerKind = "general" | "hired_sword" | "dramatis_persona" | "warband";

export type Special = CatalogueBadgeFields & {
  id: number;
  name: string;
  type?: string | null;
  /** Boons & Banes: boon, bane or trait (its icon's colour). */
  kind?: SpecialKind;
  /** Injury, mutation, aura or body (its icon). */
  category?: SpecialCategory;
  owner_kind?: SpecialOwnerKind;
  description?: string | null;
  campaign_id?: number | null;
};
