import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// api
import { getCampaign } from "../api/campaigns-api";

// other
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignSummary } from "../types/campaign-types";

/** Campaign settings and the caller's permissions change rarely, and writes update the cache. */
export const CAMPAIGN_STALE_TIME_MS = 5 * 60_000;

const NO_PERMISSIONS: string[] = [];

export function isCampaignId(campaignId: number) {
  return Number.isInteger(campaignId) && campaignId > 0;
}

/** The campaign detail payload, shared by the layout and every page that needs it. */
export function useCampaignQuery(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.detail(campaignId),
    queryFn: ({ signal }) => getCampaign(campaignId, { signal }),
    staleTime: CAMPAIGN_STALE_TIME_MS,
    enabled: isCampaignId(campaignId),
  });
}

/**
 * The caller's permission codes in the campaign (owners and admins hold every code), read
 * from the campaign payload instead of a separate /permissions/me/ request.
 */
export function useCampaignPermissions(campaignId: number) {
  const { data } = useCampaignQuery(campaignId);
  return data?.permissions ?? NO_PERMISSIONS;
}

/** Replaces the cached campaign after a settings change, keeping the caller's permissions. */
export function useSetCampaign(campaignId: number) {
  const queryClient = useQueryClient();
  return useCallback<Dispatch<SetStateAction<CampaignSummary | null>>>(
    (next) => {
      queryClient.setQueryData(
        queryKeys.campaign.detail(campaignId),
        (previous: CampaignSummary | undefined) => {
          const resolved = typeof next === "function" ? next(previous ?? null) : next;
          if (!resolved) {
            return previous;
          }
          // Update responses don't carry the caller's permissions.
          return { ...resolved, permissions: resolved.permissions ?? previous?.permissions };
        }
      );
    },
    [campaignId, queryClient]
  );
}
