import { useQueryClient } from "@tanstack/react-query";

import { useAppStore } from "@/stores/app-store";

import {
  acceptBountyClaim,
  claimBounty,
  declineBountyClaim,
  postBounty,
  withdrawBounty,
} from "../api/bounties-api";
import { settleBountyAnswer } from "../api/bounty-queries";
import { dropAnsweredClaims } from "../notifications";
import type { BountyAnswer, ClaimBountyPayload, PostBountyPayload } from "../types";

/**
 * The bounty writes of one campaign. Each resolves to the bounty as it now stands (already in the
 * cache, its warnings shown, its answered claims out of the bell) and rejects with the server's
 * refusal for the caller to show.
 */
export function useBountyActions(campaignId: number) {
  const queryClient = useQueryClient();
  const { removeBountyClaimNotification } = useAppStore();
  const settle = (answer: BountyAnswer) => {
    const bounty = settleBountyAnswer(queryClient, answer);
    dropAnsweredClaims(bounty, removeBountyClaimNotification);
    return bounty;
  };
  return {
    post: (payload: PostBountyPayload) => postBounty(campaignId, payload).then(settle),
    withdraw: (bountyId: number) => withdrawBounty(campaignId, bountyId).then(settle),
    claim: (bountyId: number, payload: ClaimBountyPayload) =>
      claimBounty(campaignId, bountyId, payload).then(settle),
    accept: (bountyId: number, claimId: number) =>
      acceptBountyClaim(campaignId, bountyId, claimId).then(settle),
    decline: (bountyId: number, claimId: number) =>
      declineBountyClaim(campaignId, bountyId, claimId).then(settle),
  };
}
