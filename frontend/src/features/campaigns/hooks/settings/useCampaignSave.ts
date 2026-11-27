import { useState } from "react";

import { getErrorMessage } from "@/lib/get-error-message";

import type { CampaignUpdatePayload } from "../../types/campaign-types";
import { useUpdateCampaign } from "../useCampaignQuery";

/** One PATCH with its pending flag and error, for a setting saved on its own. */
export function useCampaignSave(campaignId: number, fallback: string) {
  const update = useUpdateCampaign(campaignId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (payload: CampaignUpdatePayload) => {
    setSaving(true);
    setError("");
    try {
      await update(payload);
      return true;
    } catch (failure) {
      setError(getErrorMessage(failure, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, setError, save };
}
