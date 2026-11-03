import { apiRequest } from "../../../lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { WarbandRule, WarbandRulePayload } from "../types/warband-types";

export function createWarbandRule(warbandId: number, payload: WarbandRulePayload) {
  return apiRequest<WarbandRule>(`/warbands/${warbandId}/rules/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function updateWarbandRule(warbandId: number, ruleId: number, payload: WarbandRulePayload) {
  return apiRequest<WarbandRule>(`/warbands/${warbandId}/rules/${ruleId}/`, {
    method: "PATCH",
    headers: socketIdHeaders(),
    body: payload,
  });
}

export function deleteWarbandRule(warbandId: number, ruleId: number) {
  return apiRequest<void>(`/warbands/${warbandId}/rules/${ruleId}/`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}
