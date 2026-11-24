import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import {
  createCampaignRule,
  deleteCampaignRule,
  orderCampaignRules,
  updateCampaignRule,
} from "../api/campaign-rules-api";
import type { CampaignRule, CampaignRulePayload } from "../types/rule-types";

/** The ids with `id` moved one place up (-1) or down (1); unchanged at either end. */
export function movedIds(rows: { id: number }[], id: number, by: -1 | 1): number[] {
  const ids = rows.map((row) => row.id);
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** The cached list a rule's answer goes into: the Rules page's, or the Encampments page's rules. */
export type RuleStore = {
  write: (update: (rules: CampaignRule[]) => CampaignRule[]) => void;
  /** The list a reorder orders (the encampment rules order on their own). */
  kind?: "encampment";
};

/**
 * The campaign rules' writes (`manage_campaign_rules`): add, edit, delete and reorder, each answer
 * written into the cached list (`store`: the Rules page's unless another is given).
 */
export function useCampaignRuleWrites(campaignId: number, store?: RuleStore) {
  const queryClient = useQueryClient();
  const key = queryKeys.campaign.campaignRules(campaignId);
  const write =
    store?.write ??
    ((update: (rules: CampaignRule[]) => CampaignRule[]) =>
      queryClient.setQueryData<CampaignRule[]>(key, (rules?: CampaignRule[]) =>
        update(rules ?? [])
      ));

  const create = useMutation({
    mutationFn: (payload: CampaignRulePayload) => createCampaignRule(campaignId, payload),
    onSuccess: (rule) => write((rules) => [...rules, rule]),
  });
  const update = useMutation({
    mutationFn: ({ id, ...payload }: CampaignRulePayload & { id: number }) =>
      updateCampaignRule(campaignId, id, payload),
    onSuccess: (rule) =>
      write((rules) => rules.map((entry) => (entry.id === rule.id ? rule : entry))),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteCampaignRule(campaignId, id),
    onSuccess: (_answer, id) => write((rules) => rules.filter((entry) => entry.id !== id)),
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => orderCampaignRules(campaignId, ids, store?.kind),
    onSuccess: (rules) => write(() => rules),
  });
  return { create, update, remove, reorder };
}
