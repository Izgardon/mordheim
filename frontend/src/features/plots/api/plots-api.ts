import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { Plot, PlotInput, PlotRow } from "../types/plot-types";

/** `GET plots/?campaign_id=`: every plot the campaign can see, each saying whether it is in play. */
export function listPlots(campaignId: number, signal?: AbortSignal) {
  return apiRequest<PlotRow[]>(`/plots/?campaign_id=${campaignId}`, { signal });
}

/** `GET plots/:id/`: one plot with its scoring lines and its ladder. */
export function getPlot(plotId: number, signal?: AbortSignal) {
  return apiRequest<Plot>(`/plots/${plotId}/`, { signal });
}

/** `GET campaigns/:id/plots/`: the plots the campaign plays with, each whole. */
export function listCampaignPlots(campaignId: number, signal?: AbortSignal) {
  return apiRequest<Plot[]>(`/campaigns/${campaignId}/plots/`, { signal });
}

/** `PUT campaigns/:id/plots/`: the list the campaign plays with becomes these plots. */
export function setCampaignPlots(campaignId: number, plotIds: number[]) {
  return apiRequest<Plot[]>(`/campaigns/${campaignId}/plots/`, {
    method: "PUT",
    headers: socketIdHeaders(),
    body: { plot_ids: plotIds },
  });
}

export function createPlot(campaignId: number, payload: PlotInput) {
  return apiRequest<Plot>("/plots/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: { campaign_id: campaignId, ...payload },
  });
}

export function updatePlot(plotId: number, campaignId: number, payload: PlotInput) {
  return apiRequest<Plot>(`/plots/${plotId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: { campaign_id: campaignId, ...payload },
  });
}

export function deletePlot(plotId: number, campaignId: number) {
  return apiRequest<void>(`/plots/${plotId}/?campaign_id=${campaignId}`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}
