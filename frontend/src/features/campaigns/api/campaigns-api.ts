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
} from "../types/campaign-types";

export function listCampaigns() {
  return apiRequest<CampaignSummary[]>("/campaigns/");
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

export function listAdminPermissions(campaignId: number) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/permissions/admin/`, {
  });
}

export function updateAdminPermissions(campaignId: number, permissions: string[]) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/permissions/admin/`, {
    method: "PUT",
    body: { permissions },
  });
}

export function deleteCampaign(campaignId: number) {
  return apiRequest<void>(`/campaigns/${campaignId}/`, {
    method: "DELETE",
  });
}





