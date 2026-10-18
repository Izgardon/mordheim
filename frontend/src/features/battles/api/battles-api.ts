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

import { rethrowBattleWriteError } from "./battle-status-changed";

/**
 * Battle writes name this browser's socket (BUG-75), so the server leaves only this tab out of the
 * event the write broadcasts; your other tabs and devices still get it. Needs
 * `x-pusher-socket-id` in the backend's CORS_ALLOW_HEADERS.
 */
const battleWriteHeaders = () => {
  const socketId = realtimeSocketId();
  return socketId ? { "X-Pusher-Socket-Id": socketId } : undefined;
};

const battlePath = (campaignId: number, battleId: number, suffix: string) =>
  `/campaigns/${campaignId}/battles/${battleId}/${suffix}`;

/**
 * A POST to one battle's `suffix` (`"start/"`), answered with the battle's state. A refusal
 * because the battle moved on (`battle_status_changed`) also has the pages read its state (BUG-19).
 */
function battleWrite(campaignId: number, battleId: number, suffix: string, body?: unknown) {
  return apiRequest<BattleState>(battlePath(campaignId, battleId, suffix), {
    method: "POST",
    headers: battleWriteHeaders(),
    ...(body === undefined ? {} : { body }),
  }).catch((error: unknown) => rethrowBattleWriteError(error, campaignId, battleId));
}

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

/** The battle with its events after `sinceEventId`, participants in the `view` shape. */
export function getBattleState(
  campaignId: number,
  battleId: number,
  { sinceEventId = 0, view }: { sinceEventId?: number; view?: BattleStateView } = {}
) {
  const params = new URLSearchParams({ sinceEventId: String(sinceEventId) });
  if (view) {
    params.set("view", view);
  }
  return apiRequest<BattleState>(battlePath(campaignId, battleId, `state/?${params.toString()}`));
}

export function getBattleRosters(campaignId: number, battleId: number) {
  return apiRequest<BattleRosterMap>(battlePath(campaignId, battleId, "rosters/"));
}

export function joinBattle(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "join/");
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
  return battleWrite(campaignId, battleId, "config/", payload);
}

/** An invitee declines before the battle starts (BUG-45); final, and fewer than two left cancels it. */
export function declineBattleInvite(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "decline/");
}

export function setBattleReady(campaignId: number, battleId: number, ready: boolean) {
  return battleWrite(campaignId, battleId, "ready/", { ready });
}

export function cancelBattleAsCreator(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "cancel-battle/");
}

export function startBattle(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "start/");
}

/** Records a single-use item's use (the only event the pages append directly). */
export function appendBattleEvent(
  campaignId: number,
  battleId: number,
  payload: { type: "item_used"; payload_json?: Record<string, unknown> }
) {
  return battleWrite(campaignId, battleId, "events/", payload);
}

export function setUnitOutOfAction(
  campaignId: number,
  battleId: number,
  payload: { unit_key: string; out_of_action: boolean }
) {
  return battleWrite(campaignId, battleId, "unit-ooa/", payload);
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
    /** A kill added in your own postbattle (BUG-11); without it postbattle refuses. */
    source?: "postbattle";
  }
) {
  return battleWrite(campaignId, battleId, "unit-kill/", payload);
}

/** Undoes your own kill or item use until you finalise (BUG-11); the event stays, voided. */
export function voidBattleEvent(campaignId: number, battleId: number, eventId: number) {
  return battleWrite(campaignId, battleId, `events/${eventId}/void/`);
}

export function finishBattle(
  campaignId: number,
  battleId: number,
  payload: { winner_warband_ids: number[] }
) {
  return battleWrite(campaignId, battleId, "finish/", payload);
}

export function approveReportedBattleResult(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "approve-result/");
}

export function declineReportedBattleResult(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "decline-result/");
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
  return battleWrite(campaignId, battleId, "withdraw-result/");
}

export function saveBattlePostbattleDraft(
  campaignId: number,
  battleId: number,
  payload: { postbattle_json: BattlePostbattleState }
) {
  return battleWrite(campaignId, battleId, "postbattle/", payload);
}

export function finalizeBattlePostbattle(
  campaignId: number,
  battleId: number,
  payload: { postbattle_json: BattlePostbattleState }
) {
  return battleWrite(campaignId, battleId, "finalize-postbattle/", payload);
}

/**
 * Ends a battle in postbattle now (BUG-09): whoever hasn't finished is skipped. The creator's, or
 * anyone with the campaign's manage_battles permission.
 */
export function closePostbattle(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "close-postbattle/");
}

/** Skips your postbattle: nothing from the page is applied (`confirm/`). */
export function confirmBattlePostbattle(campaignId: number, battleId: number) {
  return battleWrite(campaignId, battleId, "confirm/");
}
