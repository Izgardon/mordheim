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
    /** Your reported results still waiting for answers (the overview's card). */
    pendingResults: (campaignId: number) =>
      ["campaign", campaignId, "battles", "pending-results"] as const,
    /** Prefix of everything cached for one battle the pages are showing. */
    battle: (campaignId: number, battleId: number) =>
      ["campaign", campaignId, "battle", battleId] as const,
    /** One battle's state (battle, participants, events), patched from its socket messages. */
    battleState: (campaignId: number, battleId: number) =>
      ["campaign", campaignId, "battle", battleId, "state"] as const,
    /** An ended battle's record, as a battle manager edits it (BATL-NEW-04). */
    battleRecord: (campaignId: number, battleId: number) =>
      ["campaign", campaignId, "battle", battleId, "record"] as const,
    /** The postbattle rules, the same for every battle of the campaign (broadcasts may omit them). */
    battleRules: (campaignId: number) => ["campaign", campaignId, "battle-rules"] as const,
    /** Every participant's roster for one battle (the start snapshot once it has started). */
    battleRosters: (campaignId: number, battleId: number) =>
      ["campaign", campaignId, "battle", battleId, "rosters"] as const,
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
    /** One trade request between two players of the campaign. */
    trade: (campaignId: number, requestId: string) =>
      ["campaign", campaignId, "trade", requestId] as const,
    /** Your open trades in the campaign (pending or accepted), for resuming one. */
    openTrades: (campaignId: number) => ["campaign", campaignId, "trades", "open"] as const,
  },
};
