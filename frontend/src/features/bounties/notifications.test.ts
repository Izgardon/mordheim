import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient } from "@/test/query-test-utils";

import { writeBounty } from "./api/bounty-queries";
import { handleBountyNotification, toBountyClaimNotification } from "./notifications";
import type { Bounty, BountyList } from "./types";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const notice = {
  bounty_id: 2,
  claim_id: 4,
  campaign_id: 7,
  amount: 40,
  target_name: "Grey Seer",
  claimant_user_name: "Ada",
  claimant_warband_name: "Crows",
  unit_name: "Kreech",
  battle_scenario: null,
  created_at: "2026-11-01T10:00:00Z",
  notification_id: 8,
};

const bounty = (status: Bounty["status"]): Bounty => ({
  id: 2,
  campaign_id: 7,
  status,
  amount: 40,
  note: "",
  target: {
    hero_id: 12,
    name: "Grey Seer",
    is_leader: true,
    gone: null,
    warband_id: 20,
    warband_name: "Rats",
    user_id: 2,
  },
  posted_by: { warband_id: 10, warband_name: "Monks", user_id: 1, user_name: "Pia" },
  paid_claim_id: status === "paid" ? 4 : null,
  created_at: "2026-11-01T09:00:00Z",
  closed_at: null,
  claims: [],
});

const context = () => ({
  queryClient: createTestQueryClient(),
  addBountyClaimNotification: vi.fn(),
  removeBountyClaimNotification: vi.fn(),
});

describe("bounty notifications", () => {
  it("reads a claim's notice into the bell's entry", () => {
    expect(toBountyClaimNotification(notice, 8)).toEqual({
      id: "bounty-claim-4",
      notificationDbId: 8,
      campaignId: 7,
      bountyId: 2,
      claimId: 4,
      amount: 40,
      targetName: "Grey Seer",
      claimantUserName: "Ada",
      claimantWarbandName: "Crows",
      unitName: "Kreech",
      battleScenario: null,
      createdAt: "2026-11-01T10:00:00Z",
    });
    expect(toBountyClaimNotification({ ...notice, claim_id: undefined }, 8)).toBeNull();
  });

  it("puts a claim in the poster's bell and takes it out when the claimant takes it back", () => {
    const ctx = context();
    expect(handleBountyNotification({ type: "bounty_claim", payload: notice }, ctx)).toBe(true);
    expect(ctx.addBountyClaimNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bounty-claim-4", notificationDbId: 8 })
    );
    handleBountyNotification({ type: "bounty_claim_withdrawn", payload: { claim_id: 4 } }, ctx);
    expect(ctx.removeBountyClaimNotification).toHaveBeenCalledWith("bounty-claim-4");
    expect(handleBountyNotification({ type: "trade_request" }, ctx)).toBe(false);
  });

  it("writes an answered claim's bounty into the open bounties: a paid one leaves them", () => {
    const ctx = context();
    const key = queryKeys.campaign.bounties(7);
    ctx.queryClient.setQueryData<BountyList>(key, {
      bounties: [bounty("claimed")],
      my_warband: { id: 30, name: "Crows", gold: 500 },
    });

    handleBountyNotification(
      { type: "bounty_claim_answered", payload: { status: "paid", bounty: bounty("paid") } },
      ctx
    );

    expect(ctx.queryClient.getQueryData<BountyList>(key)?.bounties).toEqual([]);
  });

  it("puts a new live bounty first and replaces one it has", () => {
    const queryClient = createTestQueryClient();
    const key = queryKeys.campaign.bounties(7);
    const other = { ...bounty("open"), id: 9 };
    queryClient.setQueryData<BountyList>(key, { bounties: [other], my_warband: null });

    writeBounty(queryClient, bounty("open"));
    writeBounty(queryClient, { ...bounty("claimed"), amount: 50 });

    const listed = queryClient.getQueryData<BountyList>(key)?.bounties ?? [];
    expect(listed.map((entry) => [entry.id, entry.status, entry.amount])).toEqual([
      [2, "claimed", 50],
      [9, "open", 40],
    ]);
  });
});
