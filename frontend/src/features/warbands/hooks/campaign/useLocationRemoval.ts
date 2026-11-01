import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { deleteCampaignLocation } from "@/features/campaigns/api/campaigns-api";
import { updateCachedList } from "@/features/campaigns/api/campaign-queries";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

/**
 * Remove a location (`manage_locations`), after a confirm: a soft delete on the server, so it
 * leaves the campaign's cached list for everyone.
 */
export function useLocationRemoval(campaignId: number) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<CampaignLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ask = (location: CampaignLocation | null) => {
    setError("");
    setRemoving(location);
  };
  const confirm = async () => {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await deleteCampaignLocation(campaignId, removing.id);
      updateCachedList<CampaignLocation>(
        queryClient,
        queryKeys.campaign.locations(campaignId),
        (list) => list.filter((entry) => entry.id !== removing.id)
      );
      setRemoving(null);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't remove the location."));
    } finally {
      setBusy(false);
    }
  };
  return { removing, busy, error, ask, confirm };
}
