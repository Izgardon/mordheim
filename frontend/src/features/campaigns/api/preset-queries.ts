import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { CampaignPreset, CampaignPresetState } from "../types/campaign-types";
import type { CampaignChart, CampaignRule } from "@/features/rules/types/rule-types";

/** The presets change only with a reseed, as the settings do: read once a session, more or less. */
const PRESETS_STALE_TIME_MS = 30 * 60_000;

export function listCampaignPresets() {
  return apiRequest<CampaignPreset[]>("/campaign-presets/");
}

/** Every published campaign a campaign may play, in the dropdown's order, with what each dictates. */
export function useCampaignPresets({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.campaignPresets(),
    queryFn: listCampaignPresets,
    staleTime: PRESETS_STALE_TIME_MS,
    enabled,
  });
}

/** What the campaign's preset dictates, where the campaign departs from it, and the rules it offers. */
export function useCampaignPreset(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.preset(campaignId),
    queryFn: () => apiRequest<CampaignPresetState>(`/campaigns/${campaignId}/preset/`),
    enabled: Number.isInteger(campaignId) && campaignId > 0,
  });
}

/** What the swap answers: how many went and arrived, and the campaign's rules and charts as they now stand. */
export type PresetSwap = {
  out: number;
  in: number;
  rules: CampaignRule[];
  charts: CampaignChart[];
};

/**
 * Swaps the campaign's preset content: out with the rules and charts that are still another published campaign's
 * word for word, in with this one's that it lacks (the server decides both). Its rules, its charts and this card
 * are read again.
 *
 * The answer is an object, not a list. It was typed as `CampaignRule[]` and written whole into the rules cache,
 * so the page then read `{rules, charts}` where it expected an array and threw (William, 20 Nov 2026: "Page
 * errors when i changed campaign setting and added new rules").
 */
export function useAddPresetRules(campaignId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<PresetSwap>(`/campaigns/${campaignId}/preset/rules/`, { method: "POST" }),
    onSuccess: (swap) => {
      queryClient.setQueryData(queryKeys.campaign.campaignRules(campaignId), swap.rules);
      queryClient.setQueryData(queryKeys.campaign.campaignCharts(campaignId), swap.charts);
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.preset(campaignId) });
    },
  });
}

/** What the preset sets, and the departure warning, by campaign settings field. */
export type PresetLocks = {
  /** The preset's name, "" for a campaign that picked none. */
  name: string;
  /** What it dictates, by field: the control is greyed, still operable. */
  sets: Map<string, string>;
  /** The warning for a field the campaign no longer holds the preset's value of. */
  departures: Map<string, string>;
};

export const NO_LOCKS: PresetLocks = { name: "", sets: new Map(), departures: new Map() };

/** The campaign's preset as the settings controls read it (the server words every line). */
export function usePresetLocks(campaignId: number): PresetLocks {
  const { data } = useCampaignPreset(campaignId);
  return useMemo(() => {
    if (!data?.preset_id) return NO_LOCKS;
    return {
      name: data.preset_name,
      sets: new Map(data.sets.map((entry) => [entry.field, entry.text])),
      departures: new Map(data.departures.map((entry) => [entry.field, entry.message])),
    };
  }, [data]);
}
