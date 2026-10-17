/**
 * Query keys for TanStack Query.
 *
 * Everything that belongs to a campaign lives under ["campaign", campaignId, ...], so
 * `queryClient.invalidateQueries({ queryKey: queryKeys.campaign.all(id) })` refreshes the whole
 * campaign (pull-to-refresh relies on this). Add new campaign-scoped keys below `campaign`.
 */

import type { UnitKindKey } from "@/features/warbands/types/units";

export type CatalogueKind =
  | "items"
  | "item-properties"
  | "skills"
  | "spells"
  | "specials"
  | "races"
  | "bestiary"
  | "hired-swords";

export const queryKeys = {
  campaign: {
    all: (campaignId: number) => ["campaign", campaignId] as const,
    detail: (campaignId: number) => ["campaign", campaignId, "detail"] as const,
    catalogue: (campaignId: number, kind: CatalogueKind) =>
      ["campaign", campaignId, "catalogue", kind] as const,
    openBattles: (campaignId: number) => ["campaign", campaignId, "battles", "open"] as const,
    /** Your own warband in the campaign (the list endpoint's first row, or null). */
    myWarband: (campaignId: number) => ["campaign", campaignId, "warband", "mine"] as const,
    /** Prefix of everything cached for one warband. */
    warband: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId] as const,
    warbandDetail: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "detail"] as const,
    warbandSummary: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "summary"] as const,
    warbandUnits: (campaignId: number, warbandId: number, kind: UnitKindKey) =>
      ["campaign", campaignId, "warband", warbandId, "units", kind] as const,
    warbandStash: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "stash"] as const,
  },
};
