import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// api
import { handOverOwnership } from "../../api/campaign-lifecycle-api";

// other
import { apiErrorCode, getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignMember, CampaignSummary } from "../../types/campaign-types";

export const MAKE_ADMIN_FIRST = "Make them an admin first";
const NOT_AN_ADMIN = "Ownership can only go to an admin. Make them an admin first.";

/**
 * Hand ownership to an admin (decision 4, CAMP-NEW-02, `capabilities.hand_over`). The owner picks
 * an admin and confirms; a player's row says to make them an admin first instead. Afterwards the
 * campaign (your capabilities) and the members (both roles) are read again.
 */
export function useHandOver(campaign: CampaignSummary) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<CampaignMember | null>(null);
  const [error, setError] = useState("");
  const [isHandingOver, setIsHandingOver] = useState(false);

  const requestHandOver = (member: CampaignMember) => {
    if (member.role !== "admin") {
      toast(MAKE_ADMIN_FIRST, {
        description: `Tick Admin on ${member.name}'s row, then Make owner.`,
      });
      return;
    }
    setTarget(member);
    setError("");
  };

  const closeHandOver = () => {
    setTarget(null);
    setError("");
  };

  const confirmHandOver = async () => {
    if (!target) {
      return;
    }
    setIsHandingOver(true);
    setError("");
    try {
      await handOverOwnership(campaign.id, target.id);
      toast(`${target.name} now owns ${campaign.name}.`, { description: "You're an admin now." });
      closeHandOver();
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.detail(campaign.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaign.members(campaign.id) });
    } catch (errorResponse) {
      setError(
        apiErrorCode(errorResponse) === "not_an_admin"
          ? NOT_AN_ADMIN
          : getErrorMessage(errorResponse, "Couldn't hand the campaign over.")
      );
    } finally {
      setIsHandingOver(false);
    }
  };

  return { target, error, isHandingOver, requestHandOver, closeHandOver, confirmHandOver };
}
