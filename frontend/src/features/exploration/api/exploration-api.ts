import { apiRequest } from "@/lib/api-client";

import type { ExplorationChart, ExplorationChartRow } from "../types/exploration-types";

/** `GET campaigns/:id/exploration/`: the whole chart the campaign explores by, in one cached read. */
export function getCampaignChart(campaignId: number, signal?: AbortSignal) {
  return apiRequest<ExplorationChart>(`/campaigns/${campaignId}/exploration/`, { signal });
}

/** `GET exploration-charts/?campaign_id=`: the charts the campaign may pick between. */
export function listExplorationCharts(campaignId: number, signal?: AbortSignal) {
  return apiRequest<ExplorationChartRow[]>(`/exploration-charts/?campaign_id=${campaignId}`, {
    signal,
  });
}
