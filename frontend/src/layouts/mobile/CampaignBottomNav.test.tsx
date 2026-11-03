/**
 * The phone's bottom nav on the real routes over the fake API server: Battle (back to your battle,
 * else Start a battle where you are) and the Me sheet (the campaign's settings and your account,
 * nothing of the warband's).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BattleState } from "@/features/battles/types/battle-types";
import type { CampaignPlayer } from "@/features/campaigns/types/campaign-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/rules/routes/HouseRules";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

const BASE = `/campaigns/${CAMPAIGN_ID}`;
const bottomNav = () => screen.findByRole("navigation", { name: "Main" });

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
});

afterEach(() => {
  cleanupApps();
});

describe("the Me sheet", () => {
  it("lists only Settings and Account, even with the Encampment and Locations on, and Account opens in the campaign", async () => {
    fakeApi.on(
      `GET ${BASE}/`,
      campaignSummary({ enable_encampments: true, enable_locations: true })
    );
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    await user.click(within(await bottomNav()).getByRole("button", { name: "Me" }));

    const sheet = await screen.findByRole("dialog", { name: "Me" });
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Settings", "Account"]);
    expect(within(sheet).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      `${BASE}/settings`
    );

    await user.click(within(sheet).getByRole("link", { name: "Account" }));

    expect(app.location().pathname).toBe(`${BASE}/account`);
    expect(await screen.findAllByRole("heading", { name: "Account", level: 1 })).not.toHaveLength(
      0
    );
    expect(within(await bottomNav()).getByRole("button", { name: "Me" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

const player = (id: number, name: string, warband: string): CampaignPlayer => ({
  id,
  name,
  warband: { id: id + 100, name: warband, type_name: "Reiklanders", wins: 0, losses: 0 },
});
const PLAYERS = [player(RAIDER.id, "Raider", "Iron Vultures"), player(9, "Mira", "Night Razors")];

/** A battle you are in and have not finished: one to go back to. */
const openBattle = (id: number, page: "prebattle" | "active", scenario = "Street Fight") =>
  ({
    battle: { id, campaign_id: CAMPAIGN_ID, status: page, flow_type: "normal", scenario },
    participants: [
      { user: { id: RAIDER.id }, status: page === "active" ? "in_battle" : "accepted" },
    ],
    viewer: {
      participant_status: page === "active" ? "in_battle" : "accepted",
      unfinished: true,
      page,
    },
  }) as unknown as BattleState;
const OPEN_BATTLE = openBattle(31, "prebattle");

const battleButton = async () => within(await bottomNav()).getByRole("button", { name: "Battle" });

describe("Battle", () => {
  beforeEach(() => {
    fakeApi.on(`GET ${BASE}/`, campaignSummary());
    fakeApi.on(`GET ${BASE}/players/`, PLAYERS);
  });

  it("goes back to your battle when you have one", async () => {
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [OPEN_BATTLE]);
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);
    // until the open battles answer, there is none to go back to
    await waitFor(async () => expect(await battleButton()).not.toHaveAttribute("aria-haspopup"));

    await user.click(await battleButton());

    expect(app.location().pathname).toBe(`${BASE}/battles/31/prebattle`);
    expect(screen.queryByRole("dialog", { name: "Start a battle" })).toBeNull();
  });

  it("goes to the battle the banner picks when you have several: your fight before a pre-battle", async () => {
    // the list comes newest first: the pre-battle is newer than the fight
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [
      openBattle(32, "prebattle", "Ambush"),
      openBattle(31, "active", "Street Fight"),
    ]);
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    const banner = await screen.findByRole("status", { name: "Your battle" });
    expect(banner).toHaveTextContent("You're in a battle: Street Fight");
    expect(within(banner).getByRole("link", { name: "+1 more" })).toHaveAttribute(
      "href",
      `${BASE}/battles`
    );
    expect(within(banner).getByRole("link", { name: "Rejoin" })).toHaveAttribute(
      "href",
      `${BASE}/battles/31/active`
    );

    await user.click(await battleButton());

    expect(app.location().pathname).toBe(`${BASE}/battles/31/active`);
  });

  it("opens Start a battle on the page you are on when you have none", async () => {
    fakeApi.on(`GET ${BASE}/battles/?open=1`, []);
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);
    await waitFor(() => expect(fakeApi.calls()).toContain(`GET ${BASE}/battles/?open=1`));

    await user.click(await battleButton());

    const dialog = await screen.findByRole("dialog", { name: "Start a battle" });
    expect(await within(dialog).findByText("Mira · Night Razors")).toBeInTheDocument();
    expect(app.location().pathname).toBe(`${BASE}/house-rules`);
  });

  it("goes to the Battles page in an archived campaign, which takes no new battles", async () => {
    fakeApi.on(`GET ${BASE}/`, campaignSummary({ archived_at: "2026-10-30T18:00:00Z" }));
    fakeApi.on(`GET ${BASE}/battles/?open=1`, []);
    renderApp(`${BASE}/house-rules`);

    const battle = within(await bottomNav()).getByRole("link", { name: "Battle" });

    expect(battle).toHaveAttribute("href", `${BASE}/battles`);
  });
});
