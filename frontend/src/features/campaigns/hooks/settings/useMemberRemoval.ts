import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { removeCampaignMember } from "../../api/campaigns-api";
import { updateCachedList } from "../../api/campaign-queries";
import { invalidateOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";

// other
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignMember } from "../../types/campaign-types";

/**
 * Remove from campaign (decision 1): the dialog's target, then the membership DELETE. The row
 * leaves the cached members list, and the battles the removal closed are read again.
 */
export function useMemberRemoval(campaignId: number) {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<CampaignMember | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  const requestRemoveMember = (member: CampaignMember) => {
    setRemoveTarget(member);
    setRemoveOpen(true);
    setRemoveError("");
  };

  const closeRemoveDialog = () => {
    setRemoveOpen(false);
    setRemoveTarget(null);
    setRemoveError("");
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) {
      return;
    }
    setIsRemoving(true);
    setRemoveError("");
    try {
      await removeCampaignMember(campaignId, removeTarget.id);
      updateCachedList<CampaignMember>(
        queryClient,
        queryKeys.campaign.members(campaignId),
        (prev) => prev.filter((member) => member.id !== removeTarget.id)
      );
      closeRemoveDialog();
      // Their open battles were cancelled or skipped them: the rail's and Active Battles' lists.
      void invalidateOpenBattles(queryClient, campaignId);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.activeBattles(campaignId),
      });
    } catch (errorResponse) {
      setRemoveError(getErrorMessage(errorResponse, "Unable to remove member"));
    } finally {
      setIsRemoving(false);
    }
  };

  return {
    removeTarget,
    removeOpen,
    removeError,
    isRemoving,
    requestRemoveMember,
    closeRemoveDialog,
    handleRemoveMember,
  };
}
