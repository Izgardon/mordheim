import { apiRequest } from "@/lib/api-client";
import { realtimeSocketId } from "@/lib/realtime/client";

import type {
  BattleCustomUnit,
  BattleCreatePayload,
  BattlePostbattleState,
  ReportBattleResultPayload,
  BattleRosterMap,
  BattleState,
  BattleStateView,
  PendingReportedResult,
} from "@/features/battles/types/battle-types";
import type { UnitInformationPatch } from "@/features/battles/utils/unit-information-patch";

/**
 * Battle writes name this browser's socket (BUG-75), so the server leaves only this tab out of the
 * event the write broadcasts; your other tabs and devices still get it. Needs
 * `x-pusher-socket-id` in the backend's CORS_ALLOW_HEADERS.
 */
const battleWriteHeaders = () => {
  const socketId = realtimeSocketId();
  return socketId ? { "X-Pusher-Socket-Id": socketId } : undefined;
};

/** The caller's battles in this campaign that haven't ended or been canceled. */
export function listOpenCampaignBattles(
  campaignId: number,
  { signal }: { signal?: AbortSignal } = {}
) {
  return apiRequest<BattleState[]>(`/campaigns/${campaignId}/battles/?open=1`, { signal });
}

export function createBattle(campaignId: number, payload: BattleCreatePayload) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/`, {
    method: "POST",
    headers: battleWriteHeaders(),
    body: payload,
  });
}

export function reportBattleResult(campaignId: number, payload: ReportBattleResultPayload) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/report-result/`, {
    method: "POST",
    headers: battleWriteHeaders(),
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
    headers: battleWriteHeaders(),
  });
}

export function saveBattleParticipantConfig(
  campaignId: number,
  battleId: number,
  // Partial update: the server keeps its stored value for any key that is omitted.
  // `unit_information_patch` changes only the units and fields it names (BUG-44);
  // `unit_information_json` (prebattle's whole form) replaces every unit's editable fields.
  payload: {
    selected_unit_keys_json?: string[];
    unit_information_patch?: UnitInformationPatch;
    unit_information_json?: Record<string, unknown>;
    custom_units_json?: BattleCustomUnit[];
    declared_rating?: number | null;
    battle_notes?: string;
  }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/config/`, {
    method: "POST",
    headers: battleWriteHeaders(),
    body: payload,
  });
}

/** An invitee declines before the battle starts (BUG-45); final, and fewer than two left cancels it. */
export function declineBattleInvite(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/decline/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}

export function setBattleReady(campaignId: number, battleId: number, ready: boolean) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/ready/`, {
    method: "POST",
    headers: battleWriteHeaders(),
    body: { ready },
  });
}

export function cancelBattlePrebattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/cancel/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}

export function cancelBattleAsCreator(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/cancel-battle/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}

export function startBattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/start/`, {
    method: "POST",
    headers: battleWriteHeaders(),
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
    headers: battleWriteHeaders(),
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
    headers: battleWriteHeaders(),
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
    headers: battleWriteHeaders(),
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
    headers: battleWriteHeaders(),
    body: payload,
  });
}

export function approveReportedBattleResult(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/approve-result/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}

export function declineReportedBattleResult(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/decline-result/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}

/** Your reported results in the campaign still waiting for answers, newest first (BUG-46). */
export function listPendingReportedResults(
  campaignId: number,
  { signal }: { signal?: AbortSignal } = {}
) {
  return apiRequest<PendingReportedResult[]>(`/campaigns/${campaignId}/battles/pending-results/`, {
    signal,
  });
}

/** The submitter takes a reported result back; it is cancelled for everyone. */
export function withdrawReportedBattleResult(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/withdraw-result/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}

export function saveBattlePostbattleDraft(
  campaignId: number,
  battleId: number,
  payload: { postbattle_json: BattlePostbattleState }
) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/postbattle/`, {
    method: "POST",
    headers: battleWriteHeaders(),
    body: payload,
  });
}

export function finalizeBattlePostbattle(
  campaignId: number,
  battleId: number,
  payload: { postbattle_json: BattlePostbattleState }
) {
  return apiRequest<BattleState>(
    `/campaigns/${campaignId}/battles/${battleId}/finalize-postbattle/`,
    {
      method: "POST",
      headers: battleWriteHeaders(),
      body: payload,
    }
  );
}

/**
 * Ends a battle in postbattle now (BUG-09): whoever hasn't finished is skipped. The creator's, or
 * anyone with the campaign's manage_battles permission.
 */
export function closePostbattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/close-postbattle/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}

export function confirmBattlePostbattle(campaignId: number, battleId: number) {
  return apiRequest<BattleState>(`/campaigns/${campaignId}/battles/${battleId}/confirm/`, {
    method: "POST",
    headers: battleWriteHeaders(),
  });
}
