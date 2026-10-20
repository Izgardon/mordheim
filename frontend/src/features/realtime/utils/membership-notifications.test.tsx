/**
 * `membership_removed` as the app receives it (RealtimeProvider above the campaign layout, fake
 * socket and server): the removed player is told, leaves the campaign's pages and the bell is
 * read again; elsewhere, only the toast.
 */
import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PLAYER,
  campaignFor,
  routeCampaignShell,
  routeOverviewLists,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 9, email: "mira@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const MY_CHANNEL = `private-user-${PLAYER.id}-notifications`;

const removed = (campaignId: number, campaignName: string) =>
  act(() =>
    fakeRealtime.emit(MY_CHANNEL, "notification", {
      type: "membership_removed",
      payload: { campaign_id: campaignId, campaign_name: campaignName, removed_by: "Aldric" },
    })
  );

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell({ campaign: campaignFor("player"), viewer: PLAYER });
  routeOverviewLists();
});

describe("Removed from a campaign (decision 1)", () => {
  it("tells the player, takes them off the campaign's pages and reads the bell again", async () => {
    renderCampaignRoute("/campaigns/1/skills");
    expect(await screen.findByText("Skills page")).toBeInTheDocument();
    await waitFor(() => expect(fakeRealtime.subscriberCount(MY_CHANNEL)).toBe(1));
    const bellReads = fakeApi.countOf("GET /notifications/");

    await removed(1, "Shards of the Comet");

    expect(
      await screen.findByText("You were removed from Shards of the Comet by Aldric.")
    ).toBeInTheDocument();
    expect(screen.getByText("Your warband is kept and comes back if you rejoin.")).toBeVisible();
    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    await waitFor(() => expect(fakeApi.countOf("GET /notifications/")).toBe(bellReads + 1));
    // Nothing reads the campaign it can no longer see.
    expect(fakeApi.countOf("GET /campaigns/1/")).toBe(1);
  });

  it("only tells a player who is looking at another campaign", async () => {
    renderCampaignRoute("/campaigns/1/skills");
    expect(await screen.findByText("Skills page")).toBeInTheDocument();
    await waitFor(() => expect(fakeRealtime.subscriberCount(MY_CHANNEL)).toBe(1));

    await removed(2, "The Pit Fights");

    expect(
      await screen.findByText("You were removed from The Pit Fights by Aldric.")
    ).toBeVisible();
    expect(screen.getByLabelText("Current path")).toHaveTextContent("/campaigns/1/skills");
  });
});

describe("Your role or grants changed (CAMP-NEW-07)", () => {
  it("tells you and reads the campaign again for its capabilities, keeping you on the page", async () => {
    renderCampaignRoute("/campaigns/1/skills");
    expect(await screen.findByText("Skills page")).toBeInTheDocument();
    await waitFor(() => expect(fakeRealtime.subscriberCount(MY_CHANNEL)).toBe(1));
    const reads = fakeApi.countOf("GET /campaigns/1/");

    act(() =>
      fakeRealtime.emit(MY_CHANNEL, "notification", {
        type: "membership_changed",
        payload: {
          campaign_id: 1,
          campaign_name: "Shards of the Comet",
          change: "role",
          role: "admin",
        },
      })
    );

    expect(
      await screen.findByText("Your role in Shards of the Comet changed to admin.")
    ).toBeInTheDocument();
    await waitFor(() => expect(fakeApi.countOf("GET /campaigns/1/")).toBe(reads + 1));
    expect(screen.getByLabelText("Current path")).toHaveTextContent("/campaigns/1/skills");
  });

  it("says your permissions changed on a grants change", async () => {
    renderCampaignRoute("/campaigns/1/skills");
    expect(await screen.findByText("Skills page")).toBeInTheDocument();
    await waitFor(() => expect(fakeRealtime.subscriberCount(MY_CHANNEL)).toBe(1));

    act(() =>
      fakeRealtime.emit(MY_CHANNEL, "notification", {
        type: "membership_changed",
        payload: {
          campaign_id: 1,
          campaign_name: "Shards of the Comet",
          change: "permissions",
          permissions: ["add_custom", "manage_items"],
        },
      })
    );

    expect(
      await screen.findByText("Your permissions in Shards of the Comet changed.")
    ).toBeInTheDocument();
  });
});
