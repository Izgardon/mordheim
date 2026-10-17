// api
import { apiRequest } from "../../../lib/api-client";
import { realtimeSocketId } from "@/lib/realtime/client";

// types
import type {
  CampaignBattleHistoryEntry,
  CampaignBulletinEntry,
  CampaignCreatePayload,
  CampaignEncampment,
  CampaignEncampmentPayload,
  CampaignActiveBattle,
  CampaignJoinPayload,
  CampaignLocation,
  CampaignLocationPayload,
  CampaignMember,
  CampaignMessage,
  CampaignPermission,
  CampaignPlayer,
  CampaignPivotalMoment,
  CampaignSummary,
  CampaignTopKiller,
  CampaignUpdatePayload,
  CampaignWarband,
} from "../types/campaign-types";
import type { TradeRequest } from "@/features/warbands/types/trade-request-types";

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

export function getCampaign(campaignId: number, { signal }: { signal?: AbortSignal } = {}) {
  return apiRequest<CampaignSummary>(`/campaigns/${campaignId}/`, { signal });
}

export function updateCampaign(campaignId: number, payload: CampaignUpdatePayload) {
  return apiRequest<CampaignSummary>(`/campaigns/${campaignId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function listCampaignPlayers(campaignId: number) {
  return apiRequest<CampaignPlayer[]>(`/campaigns/${campaignId}/players/`, {});
}

export function listCampaignBattleHistory(campaignId: number) {
  return apiRequest<CampaignBattleHistoryEntry[]>(`/campaigns/${campaignId}/battle-history/`, {});
}

export function listCampaignActiveBattles(campaignId: number) {
  return apiRequest<CampaignActiveBattle[]>(`/campaigns/${campaignId}/active-battles/`, {
    method: "GET",
  });
}

export function cancelCampaignActiveBattle(campaignId: number, battleId: number) {
  return apiRequest<CampaignActiveBattle>(
    `/campaigns/${campaignId}/active-battles/${battleId}/cancel/`,
    {
      method: "POST",
    }
  );
}

export function listCampaignPivotalMoments(campaignId: number) {
  return apiRequest<CampaignPivotalMoment[]>(`/campaigns/${campaignId}/pivotal-moments/`, {});
}

export function listCampaignTopKillers(campaignId: number) {
  return apiRequest<{ top_killers: CampaignTopKiller[] }>(
    `/campaigns/${campaignId}/top-killers/`,
    {}
  );
}

export function listCampaignBulletinEntries(campaignId: number) {
  return apiRequest<CampaignBulletinEntry[]>(`/campaigns/${campaignId}/bulletin/`, {
    method: "GET",
  });
}

export function createCampaignBulletinEntry(campaignId: number, body: string) {
  return apiRequest<CampaignBulletinEntry>(`/campaigns/${campaignId}/bulletin/`, {
    method: "POST",
    body: { body },
  });
}

export function deleteCampaignBulletinEntry(campaignId: number, entryId: number) {
  return apiRequest<void>(`/campaigns/${campaignId}/bulletin/${entryId}/`, {
    method: "DELETE",
  });
}

export function listCampaignEncampments(campaignId: number) {
  return apiRequest<CampaignEncampment[]>(`/campaigns/${campaignId}/encampments/`, {
    method: "GET",
  });
}

export function createCampaignEncampment(campaignId: number, payload: CampaignEncampmentPayload) {
  return apiRequest<CampaignEncampment>(`/campaigns/${campaignId}/encampments/`, {
    method: "POST",
    body: payload,
  });
}

export function updateCampaignEncampment(
  campaignId: number,
  encampmentId: number,
  payload: Partial<CampaignEncampmentPayload>
) {
  return apiRequest<CampaignEncampment>(`/campaigns/${campaignId}/encampments/${encampmentId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function listCampaignLocations(campaignId: number) {
  return apiRequest<CampaignLocation[]>(`/campaigns/${campaignId}/locations/`, {
    method: "GET",
  });
}

export function createCampaignLocation(campaignId: number, payload: CampaignLocationPayload) {
  return apiRequest<CampaignLocation>(`/campaigns/${campaignId}/locations/`, {
    method: "POST",
    body: payload,
  });
}

export function updateCampaignLocation(
  campaignId: number,
  locationId: number,
  payload: Partial<CampaignLocationPayload>
) {
  return apiRequest<CampaignLocation>(`/campaigns/${campaignId}/locations/${locationId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function listCampaignWarbands(campaignId: number) {
  return apiRequest<CampaignWarband[]>(`/campaigns/${campaignId}/warbands/`);
}

export function listCampaignMembers(campaignId: number) {
  return apiRequest<CampaignMember[]>(`/campaigns/${campaignId}/members/`, {});
}

export function listCampaignPermissions(campaignId: number) {
  return apiRequest<CampaignPermission[]>(`/campaigns/${campaignId}/permissions/`, {});
}

export function updateMemberPermissions(campaignId: number, userId: number, permissions: string[]) {
  return apiRequest<CampaignPermission[]>(
    `/campaigns/${campaignId}/members/${userId}/permissions/`,
    {
      method: "PUT",
      body: { permissions },
    }
  );
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

/**
 * Trade writes name this browser's socket (ECON-PERF-02), so the server can leave it out of the
 * event the write broadcasts. Needs `x-pusher-socket-id` in the backend's CORS_ALLOW_HEADERS.
 */
const tradeWriteHeaders = () => {
  const socketId = realtimeSocketId();
  return socketId ? { "X-Pusher-Socket-Id": socketId } : undefined;
};

export function acceptTradeRequest(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/${requestId}/accept/`, {
    method: "POST",
    headers: tradeWriteHeaders(),
  });
}

export function updateTradeOffer(
  campaignId: number,
  requestId: string,
  payload: {
    trader_id?: number | null;
    gold?: number;
    items?: { id: number; name: string; quantity: number }[];
  }
) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/${requestId}/offer/`, {
    method: "POST",
    headers: tradeWriteHeaders(),
    body: payload,
  });
}

/** Accepts both offers as shown: `offerVersion` is the version on screen (409 if it moved on). */
export function lockTradeOffer(campaignId: number, requestId: string, offerVersion?: number) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/${requestId}/lock/`, {
    method: "POST",
    headers: tradeWriteHeaders(),
    body: offerVersion === undefined ? undefined : { offer_version: offerVersion },
  });
}

export function unlockTradeOffer(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/${requestId}/unlock/`, {
    method: "POST",
    headers: tradeWriteHeaders(),
  });
}

export function declineTradeRequest(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/${requestId}/decline/`, {
    method: "POST",
    headers: tradeWriteHeaders(),
  });
}

export function closeTradeRequest(campaignId: number, requestId: string) {
  return apiRequest<TradeRequest>(`/campaigns/${campaignId}/trade-requests/${requestId}/close/`, {
    method: "POST",
    headers: tradeWriteHeaders(),
  });
}

export function listCampaignMessages(campaignId: number, before?: number) {
  const query = before ? `?before=${before}` : "";
  return apiRequest<CampaignMessage[]>(`/campaigns/${campaignId}/messages/${query}`);
}

export function sendCampaignMessage(campaignId: number, body: string) {
  return apiRequest<CampaignMessage>(`/campaigns/${campaignId}/messages/`, {
    method: "POST",
    body: { body },
  });
}
