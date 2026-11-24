import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { CAMPAIGN_LIST_STALE_TIME_MS } from "@/features/campaigns/api/campaign-queries";
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import type { RuleStore } from "@/features/rules/hooks/useCampaignRuleWrites";
import type { CampaignRule } from "@/features/rules/types/rule-types";
import { markLedgerStale } from "@/features/warbands/api/warband-cache";
import { queryKeys } from "@/lib/query-keys";

import type {
  CampaignEncampment,
  EncampmentGroup,
  EncampmentGroupPayload,
  EncampmentPayload,
  EncampmentsPage,
  HoldingAction,
} from "../types";
import {
  changeHolding,
  createEncampment,
  createEncampmentGroup,
  deleteEncampment,
  deleteEncampmentGroup,
  listEncampments,
  updateEncampment,
  updateEncampmentGroup,
} from "./encampments-api";

const EMPTY: EncampmentsPage = { rules: [], groups: [], takers: [] };

/** The campaign's encampments page, read only while Encampments are switched on. */
export function useEncampments(campaignId: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.encampments(campaignId),
    queryFn: () => listEncampments(campaignId),
    staleTime: CAMPAIGN_LIST_STALE_TIME_MS,
    enabled: enabled && isCampaignId(campaignId),
  });
}

function writePage(
  queryClient: QueryClient,
  campaignId: number,
  update: (page: EncampmentsPage) => EncampmentsPage
) {
  queryClient.setQueryData<EncampmentsPage>(
    queryKeys.campaign.encampments(campaignId),
    (page?: EncampmentsPage) => update(page ?? EMPTY)
  );
}

/** An encampment put in its group's place (moved there, or added last). */
export function placeEncampment(
  groups: EncampmentGroup[],
  saved: CampaignEncampment
): EncampmentGroup[] {
  return groups.map((group) => {
    const others = group.encampments.filter((entry) => entry.id !== saved.id);
    if (group.id !== saved.group_id) return { ...group, encampments: others };
    const held = group.encampments.some((entry) => entry.id === saved.id);
    const encampments = held
      ? group.encampments.map((entry) => (entry.id === saved.id ? saved : entry))
      : [...others, saved];
    return { ...group, encampments };
  });
}

/** The holding rules' answers go into this page's cache (and reorder as their own list). */
export function useEncampmentRuleStore(campaignId: number): RuleStore {
  const queryClient = useQueryClient();
  return {
    kind: "encampment",
    write: (update: (rules: CampaignRule[]) => CampaignRule[]) =>
      writePage(queryClient, campaignId, (page) => ({ ...page, rules: update(page.rules) })),
  };
}

/** The groups' and encampments' writes (`manage_encampments`), each answer written into the page. */
export function useEncampmentWrites(campaignId: number) {
  const queryClient = useQueryClient();
  const groups = (update: (groups: EncampmentGroup[]) => EncampmentGroup[]) =>
    writePage(queryClient, campaignId, (page) => ({ ...page, groups: update(page.groups) }));
  return {
    createGroup: useMutation({
      mutationFn: (payload: EncampmentGroupPayload) => createEncampmentGroup(campaignId, payload),
      onSuccess: (group) => groups((all) => [...all, group]),
    }),
    updateGroup: useMutation({
      mutationFn: ({ id, ...payload }: EncampmentGroupPayload & { id: number }) =>
        updateEncampmentGroup(campaignId, id, payload),
      onSuccess: (group) => groups((all) => all.map((g) => (g.id === group.id ? group : g))),
    }),
    removeGroup: useMutation({
      mutationFn: (id: number) => deleteEncampmentGroup(campaignId, id),
      onSuccess: (_answer, id) => groups((all) => all.filter((g) => g.id !== id)),
    }),
    saveEncampment: useMutation({
      mutationFn: ({ id, ...payload }: EncampmentPayload & { id?: number }) =>
        id ? updateEncampment(campaignId, id, payload) : createEncampment(campaignId, payload),
      onSuccess: (saved) => groups((all) => placeEncampment(all, saved)),
    }),
    removeEncampment: useMutation({
      mutationFn: (id: number) => deleteEncampment(campaignId, id),
      onSuccess: (_answer, id) =>
        groups((all) =>
          all.map((g) => ({ ...g, encampments: g.encampments.filter((e) => e.id !== id) }))
        ),
    }),
  };
}

type Holding = { encampment: CampaignEncampment; action: HoldingAction; warbandId?: number };

/**
 * Take, raze or give up: the encampment as the server left it goes into the page, the sheets and
 * logs of the warbands it touched (the holder before and after) read again; the caller shows the
 * warnings.
 */
export function useHolding(campaignId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ encampment, action, warbandId }: Holding) =>
      changeHolding(campaignId, encampment.id, action, warbandId),
    onSuccess: (answer, { encampment, warbandId }) => {
      writePage(queryClient, campaignId, (page) => ({
        ...page,
        groups: placeEncampment(page.groups, answer.encampment),
      }));
      const touched = new Set([encampment.holder?.id, warbandId, answer.encampment.holder?.id]);
      for (const id of touched) {
        if (!id) continue;
        void queryClient.invalidateQueries({
          queryKey: queryKeys.campaign.warbandSheet(campaignId, id),
        });
        markLedgerStale(queryClient, id);
      }
    },
  });
}
