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
    /** Your own warband in the campaign (the list endpoint's first row, or null). */
    myWarband: (campaignId: number) => ["campaign", campaignId, "warband", "mine"] as const,
    /** Prefix of everything cached for one warband. */
    warband: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId] as const,
    /** The warband page in one entry: warband, summary, capabilities and the unit lists. */
    warbandSheet: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "sheet"] as const,
    /** A summary read that refreshes the sheet's summary after a write (never observed). */
    warbandSummary: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "summary"] as const,
    warbandStash: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "stash"] as const,
    /** The warband's ledger, as the Treasury tab lists it. */
    warbandTreasury: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "treasury"] as const,
    /** The warband's log entries, as the Logs tab lists them. */
    warbandLogs: (campaignId: number, warbandId: number) =>
      ["campaign", campaignId, "warband", warbandId, "logs"] as const,
  },
};
