import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { CampaignScenario, Scenario, ScenarioInput } from "../types";

const list = (campaignId: number) => `/campaigns/${campaignId}/scenarios/`;

/** `GET campaigns/:id/scenarios/`: the campaign's list, each row whole with its weight. */
export function listCampaignScenarios(campaignId: number, signal?: AbortSignal) {
  return apiRequest<CampaignScenario[]>(list(campaignId), { signal });
}

/** `GET scenarios/?campaign_id=`: every scenario the campaign can see (Add scenario's picker). */
export function listScenarioCatalogue(campaignId: number, signal?: AbortSignal) {
  return apiRequest<Scenario[]>(`/scenarios/?campaign_id=${campaignId}`, { signal });
}

/** `GET scenarios/:id/`: one scenario whole (the battle's Rules sheet). */
export function getScenario(scenarioId: number, signal?: AbortSignal) {
  return apiRequest<Scenario>(`/scenarios/${scenarioId}/`, { signal });
}

export function addCampaignScenario(campaignId: number, scenarioId: number, weight?: number) {
  return apiRequest<CampaignScenario>(list(campaignId), {
    method: "POST",
    headers: socketIdHeaders(),
    body: { scenario_id: scenarioId, ...(weight === undefined ? {} : { weight }) },
  });
}

export function setScenarioWeight(campaignId: number, rowId: number, weight: number) {
  return apiRequest<CampaignScenario>(`${list(campaignId)}${rowId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: { weight },
  });
}

export function removeCampaignScenario(campaignId: number, rowId: number) {
  return apiRequest<void>(`${list(campaignId)}${rowId}/`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}

/** `POST campaigns/:id/scenarios/random/`: the server's weighted draw for that many warbands. */
export function drawScenario(campaignId: number, warbands: number) {
  return apiRequest<CampaignScenario>(`${list(campaignId)}random/`, {
    method: "POST",
    body: { players: warbands },
  });
}

/** `POST scenarios/`: the campaign's own scenario (the catalogue's write path, `edit_catalogue`). */
export function createScenario(campaignId: number, input: ScenarioInput) {
  return apiRequest<Scenario>("/scenarios/", {
    method: "POST",
    headers: socketIdHeaders(),
    body: { campaign_id: campaignId, ...input },
  });
}
