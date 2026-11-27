/**
 * The phone's bottom nav on the real routes over the fake API server: Battle (back to your battle,
 * else Start a battle where you are) and the Settings sheet (the campaign's settings and your
 * account, nothing of the warband's, then Campaigns and Log out).
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

const openSettingsSheet = async (user: ReturnType<typeof setupUser>) => {
  await user.click(within(await bottomNav()).getByRole("button", { name: "Settings" }));
  return screen.findByRole("dialog", { name: "Settings" });
};

describe("the Settings sheet", () => {
  it("lists only the campaign's settings and Account, even with the Encampment and Locations on, and Account opens in the campaign", async () => {
    fakeApi.on(
      `GET ${BASE}/`,
      campaignSummary({ enable_encampments: true, enable_locations: true })
    );
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    const sheet = await openSettingsSheet(user);

    // the two rows, then the footer's Home
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Campaign settings", "Account", "Home"]);
    expect(within(sheet).getByRole("link", { name: "Campaign settings" })).toHaveAttribute(
      "href",
      `${BASE}/settings`
    );

    await user.click(within(sheet).getByRole("link", { name: "Account" }));

    expect(app.location().pathname).toBe(`${BASE}/account`);
    expect(await screen.findAllByRole("heading", { name: "Account", level: 1 })).not.toHaveLength(
      0
    );
    expect(within(await bottomNav()).getByRole("button", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("ends in Home, which leaves the campaign for the list (William: '2 buttons at bottom of sheet')", async () => {
    fakeApi.on(`GET ${BASE}/`, campaignSummary());
    fakeApi.on("GET /campaigns/", []);
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    const sheet = await openSettingsSheet(user);
    await user.click(within(sheet).getByRole("link", { name: "Home" }));

    expect(app.location().pathname).toBe("/campaigns");
  });

  it("ends in Log out, which signs this device out as the web bar's does", async () => {
    fakeApi.on(`GET ${BASE}/`, campaignSummary());
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    const sheet = await openSettingsSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(app.location().pathname).toBe("/"));
    expect(localStorage.length).toBe(0);
  });
});

describe("the Reference sheet", () => {
  it("is still one button, its sheet showing References apart from Rules", async () => {
    fakeApi.on(`GET ${BASE}/`, campaignSummary());
    const user = setupUser();
    renderApp(`${BASE}/house-rules`);

    const button = within(await bottomNav()).getByRole("button", { name: "Reference" });
    expect(button).toHaveAttribute("aria-current", "page");
    await user.click(button);

    const sheet = await screen.findByRole("dialog", { name: "Reference" });
    const names = (group: string) =>
      within(within(sheet).getByRole("group", { name: group }))
        .getAllByRole("link")
        .map((link) => link.textContent);
    expect(names("References")).toEqual([
      "Wargear",
      "Skills",
      "Spells",
      "Specials",
      "Bestiary",
      "Hired swords",
      "Dramatis personae",
      "Warband lists",
    ]);
    expect(names("Rules")).toEqual(["Rules", "House rules", "Campaign rules"]);
  });

  it("searches everything from a field at the head of References, and closes", async () => {
    fakeApi.on(`GET ${BASE}/`, campaignSummary());
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    await user.click(within(await bottomNav()).getByRole("button", { name: "Reference" }));
    const sheet = await screen.findByRole("dialog", { name: "Reference" });
    await user.type(within(sheet).getByRole("searchbox", { name: "Search everything" }), "halberd");
    await user.click(within(sheet).getByRole("button", { name: "Search" }));

    await waitFor(() => expect(app.location().pathname).toBe(`${BASE}/search`));
    expect(app.location().search).toBe("?q=halberd");
    expect(screen.queryByRole("dialog", { name: "Reference" })).not.toBeInTheDocument();
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

  // William, 24 Nov 2026: "instead of banner up top prompting you to rejoin battle can the battle
  // nav icon be glowing and highlighted and we drop that on mobile"
  it("lights Battle instead of a banner, and goes to the fight before a newer pre-battle", async () => {
    // the list comes newest first: the pre-battle is newer than the fight
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [
      openBattle(32, "prebattle", "Ambush"),
      openBattle(31, "active", "Street Fight"),
    ]);
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    const battle = await battleButton();
    await waitFor(() => expect(battle).toHaveAccessibleDescription("Your battle is waiting"));
    expect(battle).toHaveClass("text-accent-hi", "[&_svg]:animate-pulse");
    expect(screen.queryByRole("status", { name: "Your battle" })).toBeNull();

    await user.click(battle);

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
