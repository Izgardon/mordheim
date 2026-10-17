/**
 * Query keys for TanStack Query.
 *
 * Everything that belongs to a campaign lives under ["campaign", campaignId, ...], so
 * `queryClient.invalidateQueries({ queryKey: queryKeys.campaign.all(id) })` refreshes the whole
 * campaign (pull-to-refresh relies on this). Add new campaign-scoped keys below `campaign`.
 */

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
  },
};
