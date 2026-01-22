import { apiRequest } from "../../../lib/api-client";
import type {
  CampaignCreatePayload,
  CampaignJoinPayload,
  CampaignMember,
  CampaignPermission,
  CampaignPlayer,
  CampaignSummary,
} from "../types/campaign-types";

export function listCampaigns(token: string) {
  return apiRequest<CampaignSummary[]>("/campaigns/", { token });
}

export function createCampaign(token: string, payload: CampaignCreatePayload) {
  return apiRequest<CampaignSummary>("/campaigns/", {
    method: "POST",
    body: payload,
    token,
  });
}

export function joinCampaign(token: string, payload: CampaignJoinPayload) {
  return apiRequest<CampaignSummary>("/campaigns/join/", {
    method: "POST",
    body: payload,
    token,
  });
}

export function getCampaign(token: string, campaignId: number) {
  return apiRequest<CampaignSummary>(`/campaigns/${campaignId}/`, {
    token,
  });
}

export function listCampaignPlayers(token: string, campaignId: number) {
  return apiRequest<CampaignPlayer[]>(`/campaigns/${campaignId}/players/`, {
    token,
  });
}

export function listCampaignMembers(token: string, campaignId: number) {
  return apiRequest<CampaignMember[]>(`/campaigns/${campaignId}/members/`, {
    token,
  });
}

export function listAdminPermissions(token: string, campaignId: number) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/permissions/admin/`, {
    token,
  });
}

export function updateAdminPermissions(token: string, campaignId: number, permissions: string[]) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/permissions/admin/`, {
    method: "PUT",
    body: { permissions },
    token,
  });
}

export function deleteCampaign(token: string, campaignId: number) {
  return apiRequest<void>(`/campaigns/${campaignId}/`, {
    method: "DELETE",
    token,
  });
}
