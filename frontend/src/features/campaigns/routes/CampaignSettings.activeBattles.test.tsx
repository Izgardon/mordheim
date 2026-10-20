/**
 * Settings → Active Battles as the app mounts it (layout, fake server): a battle manager's cancel
 * reaches the header's Rejoin at once, as the open battles are read again (BATL-NEW-03).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BATTLE_ID, battleState } from "@/test/battle-fixtures";
import { campaignApi, campaignMembers, routeCampaignShell } from "@/test/campaign-fixtures";
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

const OPEN_BATTLES = `GET ${campaignApi("battles/?open=1")}`;
const CANCEL = `POST ${campaignApi(`active-battles/${BATTLE_ID}/cancel/`)}`;
const ACTIONS = { end: false, confirm_results: false, close_postbattle: false, cancel: true };

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  fakeApi.on(`GET ${campaignApi("members/")}`, campaignMembers());
  fakeApi.on("GET /restrictions/?type=Setting", []);
  // You (the owner) are in a battle still gathering its players: the header offers Rejoin.
  const inviting = battleState({ status: "inviting" });
  fakeApi.on(OPEN_BATTLES, [
    {
      ...inviting,
      viewer: { participant_status: "accepted", unfinished: true, page: "prebattle" },
    },
  ]);
  fakeApi.on(`GET ${campaignApi("active-battles/")}`, [{ ...inviting, actions: ACTIONS }]);
  fakeApi.on(CANCEL, () => {
    // The server has it cancelled: your open battles no longer list it.
    fakeApi.on(OPEN_BATTLES, []);
    return battleState({ status: "canceled" });
  });
});

describe("Cancelling from Active Battles (BATL-NEW-03)", () => {
  it("takes the header's Rejoin away at once: the open battles are read again", async () => {
    const user = setupUser();
    renderCampaignRoute("/campaigns/1/settings?tab=campaign");
    // The top bar's Rejoin (Settings has no battle panel of its own).
    expect(await screen.findByRole("button", { name: "Rejoin Battle" })).toBeVisible();

    const section = (await screen.findByRole("heading", { name: "Active Battles" })).closest(
      "section"
    ) as HTMLElement;
    await user.click(await within(section).findByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Confirm cancel" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Rejoin Battle" })).toBeNull());
    expect(fakeApi.countOf(CANCEL)).toBe(1);
    expect(fakeApi.countOf(OPEN_BATTLES)).toBe(2);
  });
});
