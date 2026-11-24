import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import {
  addCampaignScenario,
  createScenario,
  drawScenario,
  getScenario,
  listCampaignScenarios,
  listScenarioCatalogue,
  removeCampaignScenario,
  setScenarioWeight,
} from "./scenarios-api";

import type { CampaignScenario, ScenarioInput } from "../types";

/** Scenarios change only when the campaign writes one or its list (`catalogue.changed` scenarios). */
const SCENARIO_STALE_TIME_MS = 5 * 60_000;

/** The campaign's list of scenarios with their weights. */
export function useCampaignScenarios(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaign.scenarios(campaignId),
    queryFn: ({ signal }) => listCampaignScenarios(campaignId, signal),
    enabled: enabled && campaignId > 0,
    staleTime: SCENARIO_STALE_TIME_MS,
  });
}

/** Every scenario the campaign can see, read when Add scenario opens. */
export function useScenarioCatalogue(campaignId: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.campaign.scenarioCatalogue(campaignId),
    queryFn: ({ signal }) => listScenarioCatalogue(campaignId, signal),
    enabled: enabled && campaignId > 0,
    staleTime: SCENARIO_STALE_TIME_MS,
  });
}

/** One scenario whole, by id (a battle's scenario, for the battle's Rules sheet). */
export function useScenario(campaignId: number, scenarioId: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.campaign.scenarioEntry(campaignId, scenarioId ?? 0),
    queryFn: ({ signal }) => getScenario(scenarioId as number, signal),
    enabled: campaignId > 0 && Boolean(scenarioId),
    staleTime: SCENARIO_STALE_TIME_MS,
  });
}

/** A row's answer in place of the row in the cached list (an add goes in by name). */
function useWriteRow(campaignId: number) {
  const queryClient = useQueryClient();
  return (row: CampaignScenario) =>
    queryClient.setQueryData<CampaignScenario[]>(
      queryKeys.campaign.scenarios(campaignId),
      (rows: CampaignScenario[] | undefined) =>
        rows
          ? [...rows.filter((each: CampaignScenario) => each.id !== row.id), row].sort(
              (a: CampaignScenario, b: CampaignScenario) =>
                a.scenario.name.localeCompare(b.scenario.name)
            )
          : rows
    );
}

/** A scenario joins the list (`manage_scenarios`), at 1 unless a weight is sent. */
export function useAddScenario(campaignId: number) {
  const writeRow = useWriteRow(campaignId);
  return useMutation({
    mutationFn: ({ scenarioId, weight }: { scenarioId: number; weight?: number }) =>
      addCampaignScenario(campaignId, scenarioId, weight),
    onSuccess: writeRow,
  });
}

export function useSetScenarioWeight(campaignId: number) {
  const writeRow = useWriteRow(campaignId);
  return useMutation({
    mutationFn: ({ rowId, weight }: { rowId: number; weight: number }) =>
      setScenarioWeight(campaignId, rowId, weight),
    onSuccess: writeRow,
  });
}

export function useRemoveScenario(campaignId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rowId: number) => removeCampaignScenario(campaignId, rowId),
    onSuccess: (_answer, rowId) =>
      queryClient.setQueryData<CampaignScenario[]>(
        queryKeys.campaign.scenarios(campaignId),
        (rows: CampaignScenario[] | undefined) =>
          rows?.filter((row: CampaignScenario) => row.id !== rowId)
      ),
  });
}

/** The campaign's own scenario, written in the catalogue; the catalogue's cached list goes stale. */
export function useCreateScenario(campaignId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScenarioInput) => createScenario(campaignId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign.scenarioCatalogue(campaignId) }),
  });
}

/** The server's weighted draw for that many warbands (nothing is cached). */
export function useDrawScenario(campaignId: number) {
  return useMutation({ mutationFn: (warbands: number) => drawScenario(campaignId, warbands) });
}
