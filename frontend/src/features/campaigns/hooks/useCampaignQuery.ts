import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

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

/** The settings the viewer's capabilities depend on (a switched-off page grants nothing). */
const CAPABILITY_SETTINGS = ["enable_encampments", "enable_locations"] as const;

/**
 * Writes a campaign answer (a PATCH, a new join code; later a campaign event) into the cached
 * campaign. Answers carry neither the caller's permissions nor capabilities, so the cached ones
 * are kept; when the answer switches a page on or off, the capabilities it gates are read again.
 */
export function writeCampaignAnswer(
  queryClient: QueryClient,
  campaignId: number,
  answer: CampaignSummary
) {
  const key = queryKeys.campaign.detail(campaignId);
  const previous = queryClient.getQueryData<CampaignSummary>(key);
  queryClient.setQueryData<CampaignSummary>(key, {
    ...answer,
    permissions: answer.permissions ?? previous?.permissions,
    capabilities: answer.capabilities ?? previous?.capabilities,
  });
  const gatesChanged = CAPABILITY_SETTINGS.some(
    (setting) => Boolean(previous?.[setting]) !== Boolean(answer[setting])
  );
  if (previous && !answer.capabilities && gatesChanged) {
    void queryClient.invalidateQueries({ queryKey: key, exact: true });
  }
}

/** Replaces the cached campaign after a settings change (`writeCampaignAnswer`). */
export function useSetCampaign(campaignId: number) {
  const queryClient = useQueryClient();
  return useCallback<Dispatch<SetStateAction<CampaignSummary | null>>>(
    (next) => {
      const previous = queryClient.getQueryData<CampaignSummary>(
        queryKeys.campaign.detail(campaignId)
      );
      const resolved = typeof next === "function" ? next(previous ?? null) : next;
      if (resolved) {
        writeCampaignAnswer(queryClient, campaignId, resolved);
      }
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
