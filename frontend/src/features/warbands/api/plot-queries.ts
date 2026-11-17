import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { updateWarband } from "./warbands-api";

/**
 * The warband's plot and its campaign point total (apps/plots), both on the warband PATCH. The
 * server writes the warband's plot rules from them, so the answer is not enough: the sheet (which
 * holds the rules and the plot's ladder) is read again.
 */
export function useWarbandPlot(campaignId: number, warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: { plot_id?: number | null; campaign_points?: number }) =>
      updateWarband(warbandId, change),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.warbandSheet(campaignId, warbandId),
      }),
  });
}
