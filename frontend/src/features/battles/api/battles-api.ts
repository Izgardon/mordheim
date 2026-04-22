import { apiRequest } from "@/lib/api-client";

import type {
  BattleCustomUnit,
  BattleCreatePayload,
  BattlePostbattleState,
  ReportBattleResultPayload,
  BattleRosterMap,
  BattleState,
  BattleStateView,
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

export function reportBattleResult(campaignId: number, payload: ReportBattleResultPayload) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/report-result/`, {
    method: "POST",
    body: payload,
  });
}

export function getBattleState(
  campaignId: number,
  battleId: number,
  sinceEventIdOrOptions:
    | number
    | {
        sinceEventId?: number;
        view?: BattleStateView;
      } = 0
) {
  const options =
    typeof sinceEventIdOrOptions === "number"
      ? { sinceEventId: sinceEventIdOrOptions }
      : sinceEventIdOrOptions;
  const sinceEventId = options.sinceEventId ?? 0;
  const params = new URLSearchParams({
    sinceEventId: String(sinceEventId),
  });
  if (options.view) {
    params.set("view", options.view);
  }
  return apiRequest<BattleState>(
    `/campaigns/${campaignId}/battles/${battleId}/state/?${params.toString()}`
  );
}

export function getBattleRosters(campaignId: number, battleId: number) {
  return apiRequest<BattleRosterMap>(`/campaigns/${campaignId}/battles/${battleId}/rosters/`);
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
    unit_information_json: Record<string, unknown>;
    custom_units_json?: BattleCustomUnit[];
    declared_rating?: number | null;
    battle_notes?: string;
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

export function setUnitOutOfAction(
  campaignId: number,
  battleId: number,
  payload: { unit_key: string; out_of_action: boolean }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/unit-ooa/`, {
    method: "POST",
    body: payload,
  });
}

export function recordUnitKill(
  campaignId: number,
  battleId: number,
  payload: {
    killer_unit_key: string;
    victim_unit_key?: string;
    victim_name?: string;
    notes?: string;
    earned_xp: boolean;
  }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/unit-kill/`, {
    method: "POST",
    body: payload,
  });
}

export function finishBattle(
  campaignId: number,
  battleId: number,
  payload: { winner_warband_ids: number[] }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/finish/`, {
    method: "POST",
    body: payload,
  });
}

export function approveReportedBattleResult(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/approve-result/`, {
    method: "POST",
  });
}

export function declineReportedBattleResult(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/decline-result/`, {
    method: "POST",
  });
}

export function saveBattlePostbattleDraft(
  campaignId: number,
  battleId: number,
  payload: { postbattle_json: BattlePostbattleState }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/postbattle/`, {
    method: "POST",
    body: payload,
  });
}

export function finalizeBattlePostbattle(
  campaignId: number,
  battleId: number,
  payload: { postbattle_json: BattlePostbattleState }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/finalize-postbattle/`, {
    method: "POST",
    body: payload,
  });
}

export function confirmBattlePostbattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/confirm/`, {
    method: "POST",
  });
}
