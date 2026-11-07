import { apiRequest } from "@/lib/api-client";

import type { CampaignRule, CampaignRulePayload } from "../types/rule-types";

const base = (campaignId: number) => `/campaigns/${campaignId}/campaign-rules/`;

export function listCampaignRules(campaignId: number) {
  return apiRequest<CampaignRule[]>(base(campaignId));
}

/** A new rule goes at the end of the list. */
export function createCampaignRule(campaignId: number, payload: CampaignRulePayload) {
  return apiRequest<CampaignRule>(base(campaignId), { method: "POST", body: payload });
}

export function updateCampaignRule(
  campaignId: number,
  ruleId: number,
  payload: Partial<CampaignRulePayload>
) {
  return apiRequest<CampaignRule>(`${base(campaignId)}${ruleId}/`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteCampaignRule(campaignId: number, ruleId: number) {
  return apiRequest<void>(`${base(campaignId)}${ruleId}/`, { method: "DELETE" });
}

/** Every rule's id in its new order; the answer is the list as it now stands. */
export function orderCampaignRules(campaignId: number, ids: number[]) {
  return apiRequest<CampaignRule[]>(`${base(campaignId)}order/`, {
    method: "PUT",
    body: { ids },
  });
}
