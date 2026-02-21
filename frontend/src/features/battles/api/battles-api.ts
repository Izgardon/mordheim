import { apiRequest } from "@/lib/api-client";

import type {
  BattleCustomUnit,
  BattleCreatePayload,
  BattleState,
} from "@/features/battles/types/battle-types";

export function listCampaignBattles(campaignId: number) {
  return apiRequest<BattleState[]>(`/campaigns/${campaignId}/battles/`);
}

export function createBattle(campaignId: number, payload: BattleCreatePayload) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/`, {
    method: "POST",
    body: payload,
  });
}

export function getBattleState(campaignId: number, battleId: number, sinceEventId = 0) {
  return apiRequest<BattleState>(
    `/campaigns/${campaignId}/battles/${battleId}/state/?sinceEventId=${sinceEventId}`
  );
}

export function joinBattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/join/`, {
    method: "POST",
  });
}

export function saveBattleParticipantConfig(
  campaignId: number,
  battleId: number,
  payload: {
    selected_unit_keys_json: string[];
    stat_overrides_json: Record<string, unknown>;
    custom_units_json?: BattleCustomUnit[];
  }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/config/`, {
    method: "POST",
    body: payload,
  });
}

export function setBattleReady(campaignId: number, battleId: number, ready: boolean) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/ready/`, {
    method: "POST",
    body: { ready },
  });
}

export function cancelBattlePrebattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/cancel/`, {
    method: "POST",
  });
}

export function cancelBattleAsCreator(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/cancel-battle/`, {
    method: "POST",
  });
}

export function startBattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/start/`, {
    method: "POST",
  });
}

export function appendBattleEvent(
  campaignId: number,
  battleId: number,
  payload: {
    type: "kill_recorded" | "death_recorded" | "item_used";
    payload_json?: Record<string, unknown>;
  }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/events/`, {
    method: "POST",
    body: payload,
  });
}

export function finishBattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/finish/`, {
    method: "POST",
  });
}

export function declareBattleWinner(campaignId: number, battleId: number, winnerWarbandId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/winner/`, {
    method: "POST",
    body: { winner_warband_id: winnerWarbandId },
  });
}

export function confirmBattlePostbattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/confirm/`, {
    method: "POST",
  });
}
