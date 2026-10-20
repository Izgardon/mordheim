import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// other
import { onApiRefusal } from "@/lib/api-refusals";
import { apiErrorCode, getRefusalMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

/**
 * Any write refused with 403 `campaign_archived` (decision 5), from whichever page: its reason as
 * a toast, and the campaign read again, so its banner and capabilities catch up.
 */
export function useArchivedRefusals(campaignId: number) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      onApiRefusal((error) => {
        if (apiErrorCode(error) !== "campaign_archived") {
          return;
        }
        toast.error(getRefusalMessage(error, "This campaign is archived."), {
          id: "campaign-archived",
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.detail(campaignId) });
      }),
    [campaignId, queryClient]
  );
}
