import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// api
import {
  archiveCampaign,
  deleteCampaignForGood,
  restoreCampaign,
} from "../../api/campaign-lifecycle-api";
import { writeCampaignAnswer } from "../useCampaignQuery";

// other
import { getRefusalMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignSummary } from "../../types/campaign-types";

type Pending = "archive" | "restore" | "delete" | null;

/**
 * Archive, restore and delete for good (decision 5): the owner's lifecycle actions. Archive and
 * restore answer the campaign (with its new capabilities), which goes into the cached campaign;
 * deleting for good needs the campaign's name and leaves for the campaigns list.
 */
export function useCampaignLifecycle(campaign: CampaignSummary) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");

  const run = async (action: Exclude<Pending, null>, send: () => Promise<void>) => {
    setPending(action);
    setError("");
    try {
      await send();
      return true;
    } catch (errorResponse) {
      setError(getRefusalMessage(errorResponse, "That didn't go through. Please try again."));
      return false;
    } finally {
      setPending(null);
    }
  };

  const archive = () =>
    run("archive", async () => {
      writeCampaignAnswer(queryClient, campaign.id, await archiveCampaign(campaign.id));
      toast(`${campaign.name} is archived.`, {
        description: "It's read-only until you restore it from Settings.",
      });
    });

  const restore = () =>
    run("restore", async () => {
      writeCampaignAnswer(queryClient, campaign.id, await restoreCampaign(campaign.id));
      toast(`${campaign.name} is restored.`);
    });

  const deleteForGood = (typedName: string) =>
    run("delete", async () => {
      await deleteCampaignForGood(campaign.id, typedName.trim());
      toast(`${campaign.name} is deleted for good.`);
      navigate("/campaigns");
      queryClient.removeQueries({ queryKey: queryKeys.campaign.all(campaign.id) });
    });

  return { pending, error, clearError: () => setError(""), archive, restore, deleteForGood };
}
