import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { getCampaignChart, listExplorationCharts } from "./exploration-api";

/** The chart changes only when the campaign picks another one or edits it (`catalogue.changed`). */
const CHART_STALE_TIME_MS = 5 * 60_000;

/**
 * The campaign's exploration chart, read once for the post-game's Explore tab: its income table,
 * its dice rule and the places with their rules text. The battle's `rules` carry the chart's
 * outline only, so the thirty places never ride a 10 KB broadcast.
 */
export function useCampaignExplorationChart(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaign.explorationChart(campaignId),
    queryFn: ({ signal }) => getCampaignChart(campaignId, signal),
    enabled: enabled && campaignId > 0,
    staleTime: CHART_STALE_TIME_MS,
  });
}

/** The charts the campaign may pick between (Settings → Exploration). */
export function useExplorationCharts(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaign.explorationCharts(campaignId),
    queryFn: ({ signal }) => listExplorationCharts(campaignId, signal),
    enabled: enabled && campaignId > 0,
    staleTime: CHART_STALE_TIME_MS,
  });
}
