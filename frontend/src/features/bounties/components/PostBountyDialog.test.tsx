/**
 * Post a bounty from a hero's card: what it sends, and the "can't afford it right now" warning,
 * which waits for a reward (a warband below 0 read "would come to 0 gc" before one was typed).
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import PostBountyDialog from "./PostBountyDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ removeBountyClaimNotification: vi.fn() }),
}));

const target = { heroId: 12, name: "Grey Seer", warbandName: "Rats" };

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /campaigns/7/bounties/", {
    bounties: [],
    my_warband: { id: 30, name: "Crows", gold: -10 },
  });
});

describe("Post a bounty", () => {
  it("warns that the warband can't afford it only once a reward is typed, and posts anyway", async () => {
    const onClose = vi.fn();
    fakeApi.on("POST /campaigns/7/bounties/", () => ({
      id: 1,
      campaign_id: 7,
      status: "open",
      amount: 25,
      note: "For the chapel",
      target: {
        hero_id: 12,
        name: "Grey Seer",
        is_leader: true,
        gone: null,
        warband_id: 20,
        warband_name: "Rats",
        user_id: 2,
      },
      posted_by: { warband_id: 30, warband_name: "Crows", user_id: 3, user_name: "Ada" },
      paid_claim_id: null,
      created_at: "2026-11-01T10:00:00Z",
      closed_at: null,
      claims: [],
    }));
    const user = setupUser();
    const { queryClient } = renderWithQueryClient(
      <PostBountyDialog open onClose={onClose} campaignId={7} target={target} />
    );

    // once the list (and your warband's gold, -10 gc) is in: still no warning without a reward
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.campaign.bounties(7))).toBeTruthy()
    );
    expect(screen.getByText(/Nothing is held now/)).toBeInTheDocument();
    expect(screen.queryByText(/Your open bounties would come to/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Reward (gc)"), "25");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your open bounties would come to 25 gc and Crows holds -10 gc."
    );
    await user.type(screen.getByLabelText("Note (optional)"), "For the chapel");
    await user.click(screen.getByRole("button", { name: "Post 25 gc" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fakeApi.bodyOf("POST /campaigns/7/bounties/")).toEqual({
      hero_id: 12,
      amount: 25,
      note: "For the chapel",
    });
  });
});
