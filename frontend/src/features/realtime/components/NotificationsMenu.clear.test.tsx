/**
 * The bell's Clear as the app mounts it (RealtimeProvider loads the notifications, the campaign
 * layout shows the bell): what it removes, whether it asks, and the requests it sends.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CAMPAIGN_ID,
  OWNER,
  PLAYER,
  campaignApi,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const inTwoDays = new Date(Date.now() + 2 * 86_400_000).toISOString();

/** What `GET /notifications/` lists: a trade request, a battle invite and a reported result. */
const pending = [
  {
    id: 51,
    notification_type: "trade_request",
    campaign_id: CAMPAIGN_ID,
    reference_id: "trade-9",
    payload: {
      id: "trade-9",
      campaign_id: CAMPAIGN_ID,
      status: "pending",
      created_at: "2026-10-18T19:00:00Z",
      expires_at: inTwoDays,
      from_user: { id: PLAYER.id, label: PLAYER.name },
      to_user: { id: OWNER.id, label: OWNER.name },
      from_warband: PLAYER.warband,
      to_warband: OWNER.warband,
    },
    created_at: "2026-10-18T19:00:00Z",
  },
  {
    id: 52,
    notification_type: "battle_invite",
    campaign_id: CAMPAIGN_ID,
    reference_id: "6",
    payload: {
      battle_id: 6,
      campaign_id: CAMPAIGN_ID,
      title: "Street Fight",
      created_by_user_id: PLAYER.id,
      created_by_user_label: PLAYER.name,
    },
    created_at: "2026-10-18T19:30:00Z",
  },
  {
    id: 53,
    notification_type: "battle_result_request",
    campaign_id: CAMPAIGN_ID,
    reference_id: "41",
    payload: {
      battle_id: 41,
      campaign_id: CAMPAIGN_ID,
      scenario: "Ambush at the Bridge",
      winner_warband_ids: [PLAYER.warband!.id],
      winner_warband_names: [PLAYER.warband!.name],
      created_by_user_id: PLAYER.id,
      created_by_user_label: PLAYER.name,
    },
    created_at: "2026-10-18T20:00:00Z",
  },
];

const bell = () => screen.getByRole("button", { name: "Notifications" });

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  fakeApi.on("GET /notifications/", pending);
  fakeApi.on(`GET ${campaignApi("battles/pending-results/")}`, []);
  fakeApi.on("POST /notifications/clear-all/", { ok: true });
});

describe("Clearing the bell", () => {
  it("clears only what no longer needs an answer: the server says how many went and how many stay, and the bell lists what stays (IMP-78, CAMP-TWEAK-10)", async () => {
    const user = setupUser();
    fakeApi.on("POST /notifications/clear-all/", { ok: true, cleared: 1, kept: 2 });
    renderCampaignRoute("/campaigns/1/skills");
    await waitFor(() => expect(bell()).toHaveTextContent("3"));

    await user.click(bell());
    const menu = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(menu).getByText("Trade request from Mira")).toBeInTheDocument();
    fakeApi.clearRequests();
    // What the server still lists after Clear all: the two that need an answer.
    fakeApi.on("GET /notifications/", pending.slice(1));

    await user.click(within(menu).getByRole("button", { name: "Clear" }));

    expect(await screen.findByText("Cleared 1. 2 still need an answer.")).toBeInTheDocument();
    await waitFor(() => expect(bell()).toHaveTextContent("2"));
    expect(fakeApi.calls().filter((call) => !call.startsWith("GET"))).toEqual([
      "POST /notifications/clear-all/",
    ]);
    expect(fakeApi.countOf("GET /notifications/")).toBe(1);
  });

  it("says when nothing could be cleared", async () => {
    const user = setupUser();
    fakeApi.on("POST /notifications/clear-all/", { ok: true, cleared: 0, kept: 3 });
    renderCampaignRoute("/campaigns/1/skills");
    await waitFor(() => expect(bell()).toHaveTextContent("3"));

    await user.click(bell());
    await user.click(
      within(screen.getByRole("dialog", { name: "Notifications" })).getByRole("button", {
        name: "Clear",
      })
    );

    expect(
      await screen.findByText("Nothing to clear: 3 still need an answer.")
    ).toBeInTheDocument();
    await waitFor(() => expect(bell()).toHaveTextContent("3"));
  });
});
