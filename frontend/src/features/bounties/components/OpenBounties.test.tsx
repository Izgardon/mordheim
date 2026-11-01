/**
 * The overview's Open bounties (design E): each bounty with its reward and poster, "On your
 * captain" for its target's owner, and what each reader may do: the poster accepts and pays (or
 * declines) a claim and withdraws; another player claims it.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { Bounty, BountyClaim, BountyList } from "../types";
import OpenBounties from "./OpenBounties";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
const reader = vi.hoisted(() => ({ id: 1 }));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => ({ user: reader }) }));
const removeBountyClaimNotification = vi.hoisted(() => vi.fn());
vi.mock("@/stores/app-store", () => ({ useAppStore: () => ({ removeBountyClaimNotification }) }));

const LIST = "GET /campaigns/7/bounties/";

const claim: BountyClaim = {
  id: 4,
  status: "pending",
  warband_id: 30,
  warband_name: "Crows",
  user_id: 3,
  user_name: "Ada",
  unit_name: "Kreech",
  unit: { kind: "hero", id: 9, name: "Kreech" },
  kill_id: null,
  battle: { id: 5, scenario: "Street Fight", date: "01/11/26" },
  poster_accepted: false,
  claimant_accepted: true,
  created_at: "2026-11-01T10:00:00Z",
  answered_at: null,
};

const bounty = (overrides: Partial<Bounty> = {}): Bounty => ({
  id: 2,
  campaign_id: 7,
  status: "claimed",
  amount: 40,
  note: "For my brother",
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
  paid_claim_id: null,
  created_at: "2026-11-01T09:00:00Z",
  closed_at: null,
  claims: [claim],
  ...overrides,
});

const list = (warband: BountyList["my_warband"]): BountyList => ({
  bounties: [bounty()],
  my_warband: warband,
});

function renderPanel() {
  return renderWithQueryClient(
    <MemoryRouter>
      <OpenBounties campaignId={7} isMobile={false} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  fakeApi.reset();
  removeBountyClaimNotification.mockReset();
});

describe("Open bounties", () => {
  it("lets the poster accept and pay a claim, which takes the bounty off the list", async () => {
    reader.id = 1;
    let open = list({ id: 10, name: "Monks", gold: 500 });
    fakeApi.on(LIST, () => structuredClone(open));
    fakeApi.on("POST /campaigns/7/bounties/2/claims/4/accept/", () => {
      open = { bounties: [], my_warband: { id: 10, name: "Monks", gold: 460 } };
      return {
        ...bounty({ status: "paid", paid_claim_id: 4 }),
        claims: [{ ...claim, status: "paid" }],
      };
    });
    const user = setupUser();
    renderPanel();

    const card = (await screen.findByText("Grey Seer")).closest("li") as HTMLElement;
    expect(card).toHaveTextContent("40 gc");
    expect(card).toHaveTextContent("Rats · posted by Pia");
    expect(card).toHaveTextContent("For my brother");
    expect(card).toHaveTextContent("Ada claims it for Kreech · Street Fight");
    expect(within(card).queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Accept and pay 40 gc" }));

    expect(await screen.findByText(/No open bounties/)).toBeInTheDocument();
    expect(fakeApi.calls()).toContain("POST /campaigns/7/bounties/2/claims/4/accept/");
    expect(removeBountyClaimNotification).toHaveBeenCalledWith("bounty-claim-4");
  });

  it("shows the target's owner that it is on his captain, with nothing to claim", async () => {
    reader.id = 2;
    fakeApi.on(LIST, list({ id: 20, name: "Rats", gold: 100 }));
    renderPanel();

    const card = (await screen.findByText("Grey Seer")).closest("li") as HTMLElement;
    expect(card).toHaveTextContent("On your captain");
    expect(within(card).queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Accept/ })).not.toBeInTheDocument();
  });

  it("lets another player with a warband claim it, and post one; without a warband neither", async () => {
    reader.id = 4;
    fakeApi.on(LIST, list({ id: 40, name: "Ravens", gold: 100 }));
    const { unmount } = renderPanel();

    const card = (await screen.findByText("Grey Seer")).closest("li") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Claim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post a bounty" })).toBeInTheDocument();
    unmount();

    fakeApi.reset();
    fakeApi.on(LIST, list(null));
    renderPanel();
    await waitFor(() => expect(screen.getByText("Grey Seer")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post a bounty" })).not.toBeInTheDocument();
  });
});
