import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { refreshAfterBounty, writeBounty } from "./api/bounty-queries";
import { goldText } from "./bounty-view";
import type { Bounty, BountyClaimNotification } from "./types";

/** The poster's `bounty_claim` notification as the server sends it (list and realtime alike). */
export type BountyClaimPayload = {
  bounty_id?: number;
  claim_id?: number;
  campaign_id?: number;
  amount?: number;
  target_name?: string;
  claimant_user_name?: string;
  claimant_warband_name?: string;
  unit_name?: string;
  battle_scenario?: string | null;
  created_at?: string;
  notification_id?: number;
};

export const bountyClaimNotificationId = (claimId: number) => `bounty-claim-${claimId}`;

export function toBountyClaimNotification(
  payload: BountyClaimPayload,
  notificationDbId: number
): BountyClaimNotification | null {
  if (!payload?.claim_id || !payload.bounty_id || !payload.campaign_id) return null;
  return {
    id: bountyClaimNotificationId(payload.claim_id),
    notificationDbId,
    campaignId: payload.campaign_id,
    bountyId: payload.bounty_id,
    claimId: payload.claim_id,
    amount: payload.amount ?? 0,
    targetName: payload.target_name?.trim() || "a hero",
    claimantUserName: payload.claimant_user_name?.trim() || "A player",
    claimantWarbandName: payload.claimant_warband_name?.trim() || "",
    unitName: payload.unit_name?.trim() || "",
    battleScenario: payload.battle_scenario?.trim() || null,
    createdAt: payload.created_at || new Date().toISOString(),
  };
}

export type BountyNotificationContext = {
  queryClient: QueryClient;
  addBountyClaimNotification: (notification: BountyClaimNotification) => void;
  removeBountyClaimNotification: (notificationId: string) => void;
};

const ANSWERED: Record<string, (bounty: Bounty) => string> = {
  paid: (bounty) =>
    `${bounty.posted_by.user_name} paid your claim: ${goldText(bounty.amount)} for ${bounty.target.name}.`,
  declined: (bounty) =>
    `${bounty.posted_by.user_name} declined your claim on the bounty on ${bounty.target.name}.`,
  closed: (bounty) =>
    bounty.status === "withdrawn"
      ? `${bounty.posted_by.user_name} withdrew the bounty on ${bounty.target.name}: your claim is closed.`
      : `The bounty on ${bounty.target.name} was paid to another claim: yours is closed.`,
};

/**
 * A `bounty_*` event on the player's notification channel; false for any other event.
 * `bounty_claim` reaches the poster (the bell, and a toast); `bounty_claim_withdrawn` takes it out
 * of his bell; `bounty_claim_answered` tells the claimant how his claim ended.
 */
export function handleBountyNotification(
  message: { type: string; payload?: unknown },
  ctx: BountyNotificationContext
) {
  if (!message.type.startsWith("bounty_")) return false;
  if (message.type === "bounty_claim") {
    const payload = message.payload as BountyClaimPayload;
    const notification = toBountyClaimNotification(payload, payload?.notification_id ?? 0);
    if (notification) {
      ctx.addBountyClaimNotification(notification);
      toast(
        `${notification.claimantUserName} claims your ${goldText(notification.amount)} bounty on ${notification.targetName}.`,
        { id: notification.id }
      );
    }
  } else if (message.type === "bounty_claim_withdrawn") {
    const payload = message.payload as { claim_id?: number } | undefined;
    if (payload?.claim_id)
      ctx.removeBountyClaimNotification(bountyClaimNotificationId(payload.claim_id));
  } else if (message.type === "bounty_claim_answered") {
    const payload = message.payload as { status?: string; bounty?: Bounty } | undefined;
    const bounty = payload?.bounty;
    if (bounty?.id) {
      writeBounty(ctx.queryClient, bounty);
      refreshAfterBounty(ctx.queryClient, bounty);
      const words = ANSWERED[payload?.status ?? ""];
      if (words) toast(words(bounty), { id: `bounty-answered-${bounty.id}` });
    }
  }
  return true;
}

/** Every claim of the bounty no longer waiting leaves the bell (an answer from the bell or the panel). */
export function dropAnsweredClaims(bounty: Bounty, remove: (notificationId: string) => void) {
  for (const claim of bounty.claims) {
    if (claim.status !== "pending") remove(bountyClaimNotificationId(claim.id));
  }
}
