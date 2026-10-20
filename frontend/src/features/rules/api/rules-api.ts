// api
import { apiRequest } from "../../../lib/api-client";

// types
import type { CommonRule, HouseRule, HouseRulePayload } from "../types/rule-types";

export function listHouseRules(campaignId: number) {
  return apiRequest<HouseRule[]>(`/campaigns/${campaignId}/rules/`);
}

/** The common house rules the server offers (IMP-69), with their effect keys. */
export function listCommonRules(campaignId: number) {
  return apiRequest<CommonRule[]>(`/campaigns/${campaignId}/rules/common/`);
}

export function createHouseRule(campaignId: number, payload: HouseRulePayload) {
  return apiRequest<HouseRule>(`/campaigns/${campaignId}/rules/`, {
    method: "POST",
    body: payload,
  });
}

export function updateHouseRule(campaignId: number, ruleId: number, payload: HouseRulePayload) {
  return apiRequest<HouseRule>(`/campaigns/${campaignId}/rules/${ruleId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteHouseRule(campaignId: number, ruleId: number) {
  return apiRequest<void>(`/campaigns/${campaignId}/rules/${ruleId}/`, {
    method: "DELETE",
  });
}
