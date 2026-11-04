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

/** Add the template's rules: those of its template, for its variant and type, whose title it lacks; all its rules after. */
export function addTemplateRules(warbandId: number) {
  return apiRequest<WarbandRule[]>(`/warbands/${warbandId}/rules/from-template/`, {
    method: "POST",
    headers: socketIdHeaders(),
  });
}

/** The warband's rules, for a page that doesn't hold its sheet (the battle Rules sheet). */
export function listWarbandRules(warbandId: number) {
  return apiRequest<WarbandRule[]>(`/warbands/${warbandId}/rules/`);
}
