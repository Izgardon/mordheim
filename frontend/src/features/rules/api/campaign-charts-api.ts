import { apiRequest } from "@/lib/api-client";

import type { CampaignChart, CampaignChartPayload } from "../types/rule-types";

const base = (campaignId: number) => `/campaigns/${campaignId}/campaign-charts/`;

export function listCampaignCharts(campaignId: number) {
  return apiRequest<CampaignChart[]>(base(campaignId));
}

/** A new chart goes at the end of the list, with its results in the order they were sent. */
export function createCampaignChart(campaignId: number, payload: CampaignChartPayload) {
  return apiRequest<CampaignChart>(base(campaignId), { method: "POST", body: payload });
}

/** Sending `rows` replaces every result the chart holds; leaving them out leaves them alone. */
export function updateCampaignChart(
  campaignId: number,
  chartId: number,
  payload: Partial<CampaignChartPayload>
) {
  return apiRequest<CampaignChart>(`${base(campaignId)}${chartId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteCampaignChart(campaignId: number, chartId: number) {
  return apiRequest<void>(`${base(campaignId)}${chartId}/`, { method: "DELETE" });
}

/** Every chart's id in its new order; the answer is the list as it now stands. */
export function orderCampaignCharts(campaignId: number, ids: number[]) {
  return apiRequest<CampaignChart[]>(`${base(campaignId)}order/`, {
    method: "PUT",
    body: { ids },
  });
}
