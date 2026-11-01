import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type {
  BountyAnswer,
  BountyCandidates,
  BountyList,
  BountyTargetWarband,
  ClaimBountyPayload,
  PostBountyPayload,
} from "../types";

const base = (campaignId: number) => `/campaigns/${campaignId}/bounties/`;
const claimPath = (campaignId: number, bountyId: number, claimId: number) =>
  `${base(campaignId)}${bountyId}/claims/${claimId}/`;

export function listBounties(campaignId: number) {
  return apiRequest<BountyList>(base(campaignId));
}

/** Every other warband's heroes on its roster: who a bounty can be posted on. */
export function listBountyTargets(campaignId: number) {
  return apiRequest<BountyTargetWarband[]>(`${base(campaignId)}targets/`);
}

/** Your kills and out-of-actions of the target since the bounty was posted, your units, your battles. */
export function getBountyCandidates(campaignId: number, bountyId: number) {
  return apiRequest<BountyCandidates>(`${base(campaignId)}${bountyId}/candidates/`);
}

const write = (path: string, body: object = {}) =>
  apiRequest<BountyAnswer>(path, { method: "POST", body, headers: socketIdHeaders() });

export function postBounty(campaignId: number, payload: PostBountyPayload) {
  return write(base(campaignId), payload);
}

export function withdrawBounty(campaignId: number, bountyId: number) {
  return write(`${base(campaignId)}${bountyId}/withdraw/`);
}

export function claimBounty(campaignId: number, bountyId: number, payload: ClaimBountyPayload) {
  return write(`${base(campaignId)}${bountyId}/claims/`, payload);
}

/** Your part of a claim: the poster's accept pays it, the claimant's is given when he claims. */
export function acceptBountyClaim(campaignId: number, bountyId: number, claimId: number) {
  return write(`${claimPath(campaignId, bountyId, claimId)}accept/`);
}

/** The poster declines the claim, or the claimant takes it back. */
export function declineBountyClaim(campaignId: number, bountyId: number, claimId: number) {
  return write(`${claimPath(campaignId, bountyId, claimId)}decline/`);
}
