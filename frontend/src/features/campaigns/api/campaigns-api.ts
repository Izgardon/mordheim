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
} from "../types/campaign-types";

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

export function listCampaignPlayers(campaignId: number) {
  return apiRequest<CampaignPlayer[]>(`/campaigns/${campaignId}/players/`, {
  });
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

export function deleteCampaign(campaignId: number) {
  return apiRequest<void>(`/campaigns/${campaignId}/`, {
    method: "DELETE",
  });
}




