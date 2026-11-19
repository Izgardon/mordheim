import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import {
  createCampaignChart,
  deleteCampaignChart,
  orderCampaignCharts,
  updateCampaignChart,
} from "../api/campaign-charts-api";
import type { CampaignChart, CampaignChartPayload } from "../types/rule-types";

/**
 * The charts' writes (`manage_campaign_rules`, the same right as the campaign's rules): add, edit,
 * delete and reorder, each answer written into the cached list.
 */
export function useCampaignChartWrites(campaignId: number) {
  const queryClient = useQueryClient();
  const key = queryKeys.campaign.campaignCharts(campaignId);
  const write = (update: (charts: CampaignChart[]) => CampaignChart[]) =>
    queryClient.setQueryData<CampaignChart[]>(key, (charts?: CampaignChart[]) =>
      update(charts ?? [])
    );

  const create = useMutation({
    mutationFn: (payload: CampaignChartPayload) => createCampaignChart(campaignId, payload),
    onSuccess: (chart) => write((charts) => [...charts, chart]),
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }: CampaignChartPayload & { id: number }) =>
      updateCampaignChart(campaignId, id, payload),
    onSuccess: (chart) =>
      write((charts) => charts.map((entry) => (entry.id === chart.id ? chart : entry))),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteCampaignChart(campaignId, id),
    onSuccess: (_answer, id) => write((charts) => charts.filter((entry) => entry.id !== id)),
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => orderCampaignCharts(campaignId, ids),
    onSuccess: (charts) => queryClient.setQueryData(key, charts),
  });
  return { create, update, remove, reorder };
}
