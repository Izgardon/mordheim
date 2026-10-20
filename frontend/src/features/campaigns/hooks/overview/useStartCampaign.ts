import { useState } from "react";

// api
import { useUpdateCampaign } from "../useCampaignQuery";

// other
import { campaignCapabilities } from "../../capabilities";
import { getErrorMessage } from "@/lib/get-error-message";

// types
import type { CampaignSummary } from "../../types/campaign-types";

/**
 * Start campaign (decision 2: owners and admins, `capabilities.start`). The PATCH answer goes into
 * the cached campaign, which the overview and the XP bar read (BUG-14).
 */
export function useStartCampaign(campaign: CampaignSummary | null) {
  const updateCampaign = useUpdateCampaign(campaign?.id ?? Number.NaN);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState("");

  const handleStartCampaign = async () => {
    if (!campaign) {
      return;
    }
    setIsStarting(true);
    setStartError("");
    try {
      await updateCampaign({ in_progress: true });
      setIsStartOpen(false);
    } catch (errorResponse) {
      setStartError(getErrorMessage(errorResponse, "Unable to start campaign"));
    } finally {
      setIsStarting(false);
    }
  };

  return {
    canStartCampaign: campaignCapabilities(campaign).start,
    isUnderway: campaign?.in_progress ?? false,
    isStartOpen,
    setIsStartOpen,
    isStarting,
    startError,
    handleStartCampaign,
  };
}
