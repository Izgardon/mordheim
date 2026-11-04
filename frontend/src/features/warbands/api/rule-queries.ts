import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { isWarbandQuery } from "./warband-cache";
import { addTemplateRules } from "./warbands-rules";
import { createWarbandRule, deleteWarbandRule, updateWarbandRule } from "./warbands-api";

import type { WarbandSheet } from "../types/warband-sheet";
import type { WarbandRule, WarbandRulePayload } from "../types/warband-types";

/** The warband's rules as each cached sheet holds them, changed by `update`: what the writes answer. */
function patchSheetRules(
  queryClient: QueryClient,
  warbandId: number,
  update: (rules: WarbandRule[]) => WarbandRule[]
) {
  queryClient.setQueriesData<WarbandSheet>(
    { predicate: isWarbandQuery(warbandId, "sheet") },
    (sheet: WarbandSheet | undefined) => sheet && { ...sheet, rules: update(sheet.rules ?? []) }
  );
}

export function useRuleCreate(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WarbandRulePayload) => createWarbandRule(warbandId, payload),
    onSuccess: (created) => patchSheetRules(queryClient, warbandId, (rules) => [...rules, created]),
  });
}

export function useRuleUpdate(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, ...payload }: WarbandRulePayload & { ruleId: number }) =>
      updateWarbandRule(warbandId, ruleId, payload),
    onSuccess: (saved) =>
      patchSheetRules(queryClient, warbandId, (rules) =>
        rules.map((rule) => (rule.id === saved.id ? saved : rule))
      ),
  });
}

export function useRuleDelete(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: number) => deleteWarbandRule(warbandId, ruleId),
    onSuccess: (_answer, ruleId) =>
      patchSheetRules(queryClient, warbandId, (rules) =>
        rules.filter((rule) => rule.id !== ruleId)
      ),
  });
}

/** Add the template's rules: the sheet takes the warband's rules as they now stand, and its template reads again. */
export function useRulesFromTemplate(campaignId: number, warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => addTemplateRules(warbandId),
    onSuccess: (rules) => {
      patchSheetRules(queryClient, warbandId, () => rules);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.warbandHireTemplate(campaignId, warbandId),
      });
    },
  });
}
