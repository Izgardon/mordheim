// api
import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

// types
import type { CampaignSummary, LeavePreview } from "../types/campaign-types";

/** The owner hands ownership to an admin and becomes an admin (decision 4, CAMP-NEW-02). */
export function handOverOwnership(campaignId: number, userId: number) {
  return apiRequest<{ owner_id: number; previous_owner_id: number }>(
    `/campaigns/${campaignId}/ownership/`,
    { method: "POST", body: { user_id: userId } }
  );
}

/** What leaving would close (decision 4, CAMP-NEW-03); 400 `hand_over_first` for an owner with company. */
export function getLeavePreview(campaignId: number) {
  return apiRequest<LeavePreview>(`/campaigns/${campaignId}/leave/`);
}

/** Leave, with removal's clean-up; an owner alone archives the campaign instead. */
export function leaveCampaign(campaignId: number) {
  return apiRequest<{ outcome: "left" | "archived" }>(`/campaigns/${campaignId}/leave/`, {
    method: "POST",
  });
}

/** The owner archives the campaign: open battles and trades close, and it becomes read-only. */
export function archiveCampaign(campaignId: number) {
  return apiRequest<CampaignSummary>(`/campaigns/${campaignId}/archive/`, {
    method: "POST",
    headers: socketIdHeaders(),
  });
}

/** The owner restores an archived campaign. */
export function restoreCampaign(campaignId: number) {
  return apiRequest<CampaignSummary>(`/campaigns/${campaignId}/restore/`, {
    method: "POST",
    headers: socketIdHeaders(),
  });
}

/** Deletes an archived campaign for good; the name must match (spaces trimmed, case kept). */
export function deleteCampaignForGood(campaignId: number, name: string) {
  return apiRequest<void>(`/campaigns/${campaignId}/`, { method: "DELETE", body: { name } });
}
