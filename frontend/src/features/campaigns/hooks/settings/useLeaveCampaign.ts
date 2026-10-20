import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// api
import { getLeavePreview, leaveCampaign } from "../../api/campaign-lifecycle-api";

// other
import { campaignCapabilities } from "../../capabilities";
import { getRefusalMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/stores/app-store";

// types
import type { CampaignSummary } from "../../types/campaign-types";

/**
 * How you may leave (decision 4): as a player or admin; as the owner alone, by archiving the
 * campaign; as the owner with company, not until you hand ownership to an admin.
 */
export type LeaveMode = "leave" | "archive" | "hand_over_first";

export function leaveMode(campaign: CampaignSummary): LeaveMode | null {
  const capabilities = campaignCapabilities(campaign);
  if (capabilities.leave) return "leave";
  if (capabilities.archive && campaign.player_count === 1) return "archive";
  if (capabilities.hand_over) return "hand_over_first";
  return null;
}

/**
 * Leave the campaign (CAMP-NEW-03): the dialog reads what leaving closes, then leaving takes you
 * to the campaigns list with a toast and drops what was cached for the campaign.
 */
export function useLeaveCampaign(campaign: CampaignSummary) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentBattleSession, clearCurrentBattleSession } = useAppStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);
  const preview = useQuery({
    queryKey: queryKeys.campaign.leavePreview(campaign.id),
    queryFn: () => getLeavePreview(campaign.id),
    enabled: open,
    staleTime: 0,
    retry: false,
  });

  const openLeave = () => {
    setError("");
    setOpen(true);
  };

  const closeLeave = () => {
    setOpen(false);
    setError("");
  };

  const leave = async () => {
    setIsLeaving(true);
    setError("");
    try {
      const { outcome } = await leaveCampaign(campaign.id);
      if (outcome === "archived") {
        toast(`${campaign.name} is archived.`, {
          description: "You're still its owner: restore it from its Settings.",
        });
      } else {
        // The same id as the membership_left event's toast, so you see it once.
        toast(`You left ${campaign.name}.`, {
          id: `membership-left-${campaign.id}`,
          description: "Your warband is kept and comes back if you rejoin.",
        });
      }
      if (currentBattleSession?.campaignId === campaign.id) {
        clearCurrentBattleSession();
      }
      setOpen(false);
      navigate("/campaigns");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.all(campaign.id),
        refetchType: "none",
      });
    } catch (errorResponse) {
      setError(getRefusalMessage(errorResponse, "Couldn't leave the campaign."));
    } finally {
      setIsLeaving(false);
    }
  };

  return { open, openLeave, closeLeave, preview, error, isLeaving, leave };
}
