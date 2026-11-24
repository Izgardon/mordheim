import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type {
  CampaignEncampment,
  EncampmentGroup,
  EncampmentGroupPayload,
  EncampmentPayload,
  EncampmentsPage,
  HoldingAction,
  HoldingAnswer,
} from "../types";

const base = (campaignId: number) => `/campaigns/${campaignId}`;

/** Its encampment rules, every group in its order with its encampments, and whom you take for. */
export function listEncampments(campaignId: number) {
  return apiRequest<EncampmentsPage>(`${base(campaignId)}/encampment-groups/`);
}

export function createEncampmentGroup(campaignId: number, payload: EncampmentGroupPayload) {
  return apiRequest<EncampmentGroup>(`${base(campaignId)}/encampment-groups/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function updateEncampmentGroup(
  campaignId: number,
  groupId: number,
  payload: EncampmentGroupPayload
) {
  return apiRequest<EncampmentGroup>(`${base(campaignId)}/encampment-groups/${groupId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: payload,
  });
}

/** Takes the group and its encampments off the list for everyone (a soft delete). */
export function deleteEncampmentGroup(campaignId: number, groupId: number) {
  return apiRequest<void>(`${base(campaignId)}/encampment-groups/${groupId}/`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}

export function createEncampment(campaignId: number, payload: EncampmentPayload) {
  return apiRequest<CampaignEncampment>(`${base(campaignId)}/encampments/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function updateEncampment(campaignId: number, id: number, payload: EncampmentPayload) {
  return apiRequest<CampaignEncampment>(`${base(campaignId)}/encampments/${id}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function deleteEncampment(campaignId: number, id: number) {
  return apiRequest<void>(`${base(campaignId)}/encampments/${id}/`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}

/** Take it for a warband, raze it, or give it up: the server logs it on the warbands it touches. */
export function changeHolding(
  campaignId: number,
  id: number,
  action: HoldingAction,
  warbandId?: number
) {
  return apiRequest<HoldingAnswer>(`${base(campaignId)}/encampments/${id}/${action}/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body: warbandId ? { warband_id: warbandId } : {},
  });
}
