/**
 * Stuck battles (decision 7, CAMP-NEW-05) as the app mounts them (layout, fake server): the
 * overview's banner for battle managers, and the Start dialog's busy label as a link.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { battleState } from "@/test/battle-fixtures";
import {
  PLAYER,
  campaignApi,
  campaignFor,
  campaignPlayers,
  routeCampaignShell,
  routeOverviewLists,
} from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import type { CampaignActiveBattle } from "../types/campaign-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
const auth = vi.hoisted(() => ({
  user: { id: 7, email: "aldric@example.com" },
  signOut: () => undefined,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const ACTIVE_BATTLES = `GET ${campaignApi("active-battles/")}`;
const DAY = 86_400;
const REVIEW = "/campaigns/1/settings?tab=campaign&section=active-battles";

const activeBattle = (id: number, idleSeconds: number, stuck: boolean): CampaignActiveBattle => {
  const { battle, participants } = battleState({ id, status: "active" });
  return { battle, participants, idle_seconds: idleSeconds, stuck };
};

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: 7, email: "aldric@example.com" };
  routeCampaignShell();
  routeOverviewLists();
});

describe("Stuck battles banner (CAMP-NEW-05)", () => {
  it("tells a battle manager how long the stuck battle has been idle, with Review", async () => {
    fakeApi.on(ACTIVE_BATTLES, [
      activeBattle(40, 5 * DAY + 600, true),
      activeBattle(41, 7200, false),
    ]);

    renderCampaignRoute("/campaigns/1");

    const review = await screen.findByRole("link", { name: "Review" });
    expect(review.closest("[role=status]")).toHaveTextContent("1 battle idle for 5 days");
    expect(review).toHaveAttribute("href", REVIEW);
  });

  it("names the longest idle among several stuck battles", async () => {
    fakeApi.on(ACTIVE_BATTLES, [
      activeBattle(40, 2 * DAY, true),
      activeBattle(41, 6 * DAY, true),
      activeBattle(42, 3600, false),
    ]);

    renderCampaignRoute("/campaigns/1");

    const review = await screen.findByRole("link", { name: "Review" });
    expect(review.closest("[role=status]")).toHaveTextContent(
      "2 battles idle, the longest for 6 days"
    );
  });

  it("says nothing when no battle is stuck", async () => {
    fakeApi.on(ACTIVE_BATTLES, [activeBattle(41, 7200, false)]);

    renderCampaignRoute("/campaigns/1");

    await screen.findByRole("heading", { name: /Roster/ });
    expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
    expect(fakeApi.countOf(ACTIVE_BATTLES)).toBe(1);
  });

  it("isn't shown to, or read for, a player without manage_battles", async () => {
    auth.user = { id: PLAYER.id, email: PLAYER.email };
    routeCampaignShell({ campaign: campaignFor("player"), viewer: PLAYER });

    renderCampaignRoute("/campaigns/1");

    await screen.findByRole("heading", { name: /Roster/ });
    expect(fakeApi.countOf(ACTIVE_BATTLES)).toBe(0);
    expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
  });
});

describe("The Start dialog's busy label (CAMP-NEW-05)", () => {
  it("links a battle manager to Active Battles", async () => {
    const user = setupUser();
    fakeApi.on(ACTIVE_BATTLES, []);
    fakeApi.on(
      `GET ${campaignApi("players/")}`,
      campaignPlayers().map((player) =>
        player.id === PLAYER.id
          ? {
              ...player,
              battle_busy: true,
              battle_busy_status: "active",
              battle_busy_battle_id: 40,
            }
          : player
      )
    );
    renderCampaignRoute("/campaigns/1");

    await user.click(await screen.findByRole("button", { name: "Start battle" }));

    const dialog = screen.getByRole("dialog", { name: "Start Battle" });
    expect(within(dialog).getByRole("link", { name: "In battle #40 (active)" })).toHaveAttribute(
      "href",
      REVIEW
    );
  });

  it("stays plain text for a player without manage_battles", async () => {
    const user = setupUser();
    auth.user = { id: PLAYER.id, email: PLAYER.email };
    routeCampaignShell({ campaign: campaignFor("player"), viewer: PLAYER });
    fakeApi.on(
      `GET ${campaignApi("players/")}`,
      campaignPlayers().map((player) =>
        player.name === "Brunhilde"
          ? {
              ...player,
              battle_busy: true,
              battle_busy_status: "active",
              battle_busy_battle_id: 40,
            }
          : player
      )
    );
    renderCampaignRoute("/campaigns/1");

    await user.click(await screen.findByRole("button", { name: "Start battle" }));

    const dialog = screen.getByRole("dialog", { name: "Start Battle" });
    expect(within(dialog).getByText("In battle #40 (active)")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /In battle/ })).toBeNull();
  });
});
