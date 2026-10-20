import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// api
import { getCampaign, listCampaignPermissions, updateCampaign } from "../api/campaigns-api";

// other
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignSummary, CampaignUpdatePayload } from "../types/campaign-types";

/** Campaign settings and the caller's permissions change rarely, and writes update the cache. */
export const CAMPAIGN_STALE_TIME_MS = 5 * 60_000;

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
 * The permission codes an owner or admin can grant, with the server's labels and descriptions
 * (BUG-15). The list only changes with a deploy, so it is read once per session.
 */
export function usePermissionCatalogue(campaignId: number, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.campaign.permissionCatalogue(campaignId),
    queryFn: () => listCampaignPermissions(campaignId),
    staleTime: Infinity,
    enabled: enabled && isCampaignId(campaignId),
  });
}

/** Replaces the cached campaign after a settings change, keeping the caller's permissions and flags. */
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
          // Update responses don't carry the caller's permissions or capabilities.
          return {
            ...resolved,
            permissions: resolved.permissions ?? previous?.permissions,
            capabilities: resolved.capabilities ?? previous?.capabilities,
          };
        }
      );
    },
    [campaignId, queryClient]
  );
}

/**
 * PATCHes the campaign (a start, a settings card) and writes the answer into the layout's cached
 * campaign, which every page reads; resolves with the answer.
 */
export function useUpdateCampaign(campaignId: number) {
  const setCampaign = useSetCampaign(campaignId);
  return useCallback(
    async (payload: CampaignUpdatePayload) => {
      const updated = await updateCampaign(campaignId, payload);
      setCampaign(updated);
      return updated;
    },
    [campaignId, setCampaign]
  );
}
