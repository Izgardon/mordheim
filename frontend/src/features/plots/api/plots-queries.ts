import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import {
  createPlot,
  deletePlot,
  listCampaignPlots,
  listPlots,
  setCampaignPlots,
  updatePlot,
} from "./plots-api";

import type { PlotInput } from "../types/plot-types";

/** Plots change only when the campaign writes one or picks another list (`catalogue.changed`). */
const PLOT_STALE_TIME_MS = 5 * 60_000;

/** The plots the campaign plays with, with their scoring and their ladders. */
export function useCampaignPlots(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaign.plots(campaignId),
    queryFn: ({ signal }) => listCampaignPlots(campaignId, signal),
    enabled: enabled && campaignId > 0,
    staleTime: PLOT_STALE_TIME_MS,
  });
}

/** Every plot the campaign can see (Settings → Plots picks from these). */
export function usePlotCatalogue(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaign.plotCatalogue(campaignId),
    queryFn: ({ signal }) => listPlots(campaignId, signal),
    enabled: enabled && campaignId > 0,
    staleTime: PLOT_STALE_TIME_MS,
  });
}

/** Everything cached about the campaign's plots: its list, the catalogue it picks from, each plot. */
function usePlotsInvalidation(campaignId: number) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.campaign.plots(campaignId) });
}

/** The list the campaign plays with becomes the ids sent (`edit_settings`). */
export function useSetCampaignPlots(campaignId: number) {
  const invalidate = usePlotsInvalidation(campaignId);
  return useMutation({
    mutationFn: (plotIds: number[]) => setCampaignPlots(campaignId, plotIds),
    onSuccess: invalidate,
  });
}

/** The campaign's own plot, created or edited (`edit_catalogue`); the answer carries its warnings. */
export function useSavePlot(campaignId: number) {
  const invalidate = usePlotsInvalidation(campaignId);
  return useMutation({
    mutationFn: ({ plotId, input }: { plotId: number | null; input: PlotInput }) =>
      plotId === null ? createPlot(campaignId, input) : updatePlot(plotId, campaignId, input),
    onSuccess: invalidate,
  });
}

/** One of the campaign's own plots deleted (archived instead where something holds it). */
export function useDeletePlot(campaignId: number) {
  const invalidate = usePlotsInvalidation(campaignId);
  return useMutation({
    mutationFn: (plotId: number) => deletePlot(plotId, campaignId),
    onSuccess: invalidate,
  });
}
