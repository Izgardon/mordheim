import { useQuery, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";

import type { Bounty, BountyAnswer, BountyList } from "../types";
import { getBountyCandidates, listBounties, listBountyTargets } from "./bounties-api";

const STALE_TIME_MS = 30_000;

/** The campaign's open bounties and your warband (its gold): the overview's panel, hero cards. */
export function useCampaignBounties(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.bounties(campaignId),
    queryFn: () => listBounties(campaignId),
    staleTime: STALE_TIME_MS,
    enabled: campaignId > 0,
  });
}

/** Every other warband's heroes on its roster, read when Post a bounty opens without one. */
export function useBountyTargets(campaignId: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.campaign.bountyTargets(campaignId),
    queryFn: () => listBountyTargets(campaignId),
    staleTime: STALE_TIME_MS,
    enabled: enabled && campaignId > 0,
  });
}

/** What you can put to a claim on the bounty, read each time Claim opens (kept while it closes). */
export function useBountyCandidates(campaignId: number, bountyId: number | null, open: boolean) {
  return useQuery({
    queryKey: queryKeys.campaign.bountyCandidates(campaignId, bountyId ?? 0),
    queryFn: () => getBountyCandidates(campaignId, bountyId ?? 0),
    staleTime: 0,
    enabled: open && bountyId !== null && campaignId > 0,
  });
}

/**
 * One bounty as it now stands, written into the cached list (an answer, or `bounty.changed`): a
 * live one replaces its row or goes first, a paid or withdrawn one leaves the list.
 */
export function writeBounty(queryClient: QueryClient, bounty: Bounty) {
  queryClient.setQueryData<BountyList>(
    queryKeys.campaign.bounties(bounty.campaign_id),
    (list: BountyList | undefined) => {
      if (!list) return list;
      const live = bounty.status === "open" || bounty.status === "claimed";
      const others = list.bounties.filter((entry: Bounty) => entry.id !== bounty.id);
      if (!live) return { ...list, bounties: others };
      const index = list.bounties.findIndex((entry: Bounty) => entry.id === bounty.id);
      const bounties =
        index >= 0
          ? list.bounties.map((entry: Bounty) => (entry.id === bounty.id ? bounty : entry))
          : [bounty, ...others];
      return { ...list, bounties };
    }
  );
}

/**
 * What a bounty's change makes stale besides its row: the chronicle (posted, claimed), and once
 * it is paid the battle rows (its moment) and, for a party to it, his warband's gold (read from
 * the cached list's `my_warband`).
 */
export function refreshAfterBounty(queryClient: QueryClient, bounty: Bounty) {
  const campaignId = bounty.campaign_id;
  const myWarbandId = queryClient.getQueryData<BountyList>(queryKeys.campaign.bounties(campaignId))
    ?.my_warband?.id;
  void queryClient.invalidateQueries({
    queryKey: [...queryKeys.campaign.all(campaignId), "chronicle"],
  });
  if (bounty.status !== "paid") return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.battleHistory(campaignId) });
  const paid = bounty.claims.find((claim) => claim.id === bounty.paid_claim_id);
  const parties = [bounty.posted_by.warband_id, paid?.warband_id];
  if (myWarbandId && parties.includes(myWarbandId)) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.bounties(campaignId) });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.campaign.warband(campaignId, myWarbandId),
    });
  }
}

/**
 * A write's answer: the bounty goes into the cache with what it makes stale, and each warning the
 * write went ahead despite is a toast (an unaffordable bounty, a claim with nothing on record).
 */
export function settleBountyAnswer(queryClient: QueryClient, answer: BountyAnswer): Bounty {
  const { warnings, ...bounty } = answer;
  writeBounty(queryClient, bounty);
  refreshAfterBounty(queryClient, bounty);
  for (const warning of warnings ?? []) {
    toast.warning(warning.message, { id: `bounty-warning-${bounty.id}-${warning.code}` });
  }
  return bounty;
}
