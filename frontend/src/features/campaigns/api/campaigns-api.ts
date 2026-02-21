// api
import { apiRequest } from "../../../lib/api-client";

// types
import type {
  CampaignCreatePayload,
  CampaignJoinPayload,
  CampaignMember,
  CampaignPermission,
  CampaignPlayer,
  CampaignSummary,
  CampaignType,
  CampaignUpdatePayload,
  CampaignWarband,
} from "../types/campaign-types";
import type { TradeRequest } from "@/features/warbands/types/trade-request-types";

export function listCampaigns() {
  return apiRequest<CampaignSummary[]>("/campaigns/");
}

export function listCampaignTypes() {
  return apiRequest<CampaignType[]>("/campaigns/types/");
}

export function createCampaign(payload: CampaignCreatePayload) {
  return apiRequest<CampaignSummary>("/campaigns/", {
    method: "POST",
    body: payload,
  });
}

export function joinCampaign(payload: CampaignJoinPayload) {
  return apiRequest<CampaignSummary>("/campaigns/join/", {
    method: "POST",
    body: payload,
  });
}

export function getCampaign(campaignId: number) {
  return apiRequest<CampaignSummary>(`/campaigns/${campaignId}/`, {
  });
}

export function updateCampaign(campaignId: number, payload: CampaignUpdatePayload) {
  return apiRequest<CampaignSummary>(`/campaigns/${campaignId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function listCampaignPlayers(campaignId: number) {
  return apiRequest<CampaignPlayer[]>(`/campaigns/${campaignId}/players/`, {
  });
}

export function listCampaignWarbands(campaignId: number) {
  return apiRequest<CampaignWarband[]>(`/campaigns/${campaignId}/warbands/`);
}

export function listCampaignMembers(campaignId: number) {
  return apiRequest<CampaignMember[]>(`/campaigns/${campaignId}/members/`, {
  });
}

export function listCampaignPermissions(campaignId: number) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/permissions/`, {
  });
}

export function listMyCampaignPermissions(campaignId: number) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/permissions/me/`, {
  });
}

export function updateMemberPermissions(campaignId: number, userId: number, permissions: string[]) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/members/${userId}/permissions/`, {
    method: "PUT",
    body: { permissions },
  });
}

export function updateMemberRole(campaignId: number, userId: number, role: "admin" | "player") {
  return apiRequest<{ id: number; role: "admin" | "player" }>(
    `/campaigns/${campaignId}/members/${userId}/role/`,
    {
      method: "PATCH",
      body: { role },
    }
  );
}

export function removeCampaignMember(campaignId: number, userId: number) {
  return apiRequest<void>(`/campaigns/${campaignId}/members/${userId}/`, {
    method: "DELETE",
  });
}

export function deleteCampaign(campaignId: number) {
  return apiRequest<void>(`/campaigns/${campaignId}/`, {
    method: "DELETE",
  });
}

export function createTradeRequest(campaignId: number, targetUserId: number) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/`, {
    method: "POST",
    body: { target_user_id: targetUserId },
  });
}

export function listCampaignTradeRequests(campaignId: number, status?: TradeRequest["status"]) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<TradeRequest[]>(`/campaigns/${campaignId}/trade-requests/${query}`, {
    method: "GET",
  });
}

export function listPendingTradeRequests() {
  return apiRequest<TradeRequest[]>(`/trade-requests/pending/`, {
    method: "GET",
  });
}

export function getTradeRequest(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/${requestId}/`, {
    method: "GET",
  });
}

export function acceptTradeRequest(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(
    `/campaigns/${campaignId}/trade-requests/${requestId}/accept/`,
    {
      method: "POST",
    }
  );
}

export function updateTradeOffer(
  campaignId: number,
  requestId: string,
  payload: { trader_id?: number | null; gold?: number; items?: { id: number; name: string; quantity: number }[] }
) {
  return apiRequest<TradeRequest>(
    `/campaigns/${campaignId}/trade-requests/${requestId}/offer/`,
    {
      method: "POST",
      body: payload,
    }
  );
}

export function lockTradeOffer(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(
    `/campaigns/${campaignId}/trade-requests/${requestId}/lock/`,
    {
      method: "POST",
    }
  );
}

export function declineTradeRequest(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(
    `/campaigns/${campaignId}/trade-requests/${requestId}/decline/`,
    {
      method: "POST",
    }
  );
}

export function closeTradeRequest(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(
    `/campaigns/${campaignId}/trade-requests/${requestId}/close/`,
    {
      method: "POST",
    }
  );
}




