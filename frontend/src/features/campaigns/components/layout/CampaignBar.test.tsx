/**
 * The web bar on a campaign's pages, on the real routes over the fake API server (William: "the
 * top bar on web should be permanent, its main content changes depending on page/urgency but its
 * top left slots remain Log out and Campaigns"): Campaigns and Log out always; off the overview
 * your battle, else Raise your warband, else the archived notice, else the campaign's name and
 * the page's title; on the overview Between battles, even while you are in a battle.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignPlayer } from "@/features/campaigns/types/campaign-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/campaigns/routes/Overview";
import "@/features/rules/routes/HouseRules";
import "@/features/battles/routes/BattleLayout";
import "@/features/battles/routes/BattlePrebattle";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const BASE = `/campaigns/${CAMPAIGN_ID}`;
const MINE = `GET /warbands/?campaign_id=${CAMPAIGN_ID}`;
const OPEN = `GET ${BASE}/battles/?open=1`;

const IN_BATTLE = {
  battle: {
    id: 31,
    campaign_id: CAMPAIGN_ID,
    status: "active",
    flow_type: "normal",
    scenario: "Street Fight",
    number: 6,
  },
  participants: [{ user: { id: RAIDER.id }, status: "in_battle" }],
  viewer: { participant_status: "in_battle", unfinished: true, page: "active" },
};
const player = (id: number, name: string): CampaignPlayer => ({
  id,
  name,
  warband: { id: id + 100, name: `${name}'s band`, type_name: "Reiklanders", wins: 0, losses: 0 },
});

/**
 * The bar once the campaign is in (the rail is up; the shell's skeleton has a bar of its own): the
 * header that holds the Campaigns and Log out slots.
 */
const bar = async () => {
  await screen.findByRole("navigation", { name: "Campaign" });
  return screen.getByRole("navigation", { name: "Site" }).closest("header") as HTMLElement;
};

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${BASE}/`, campaignSummary());
  fakeApi.on(MINE, [{ id: 101, name: "Iron Vultures" }]);
  fakeApi.on(OPEN, []);
  fakeApi.on(`GET ${BASE}/players/`, [player(RAIDER.id, "Raider"), player(9, "Mira")]);
  fakeApi.on(`GET ${BASE}/battle-history/`, []);
});

afterEach(() => {
  cleanupApps();
});

describe("the web bar's fixed slots", () => {
  it("are Campaigns and Log out on every campaign page, the battle screens included", async () => {
    renderApp(`${BASE}/battles/31/prebattle`);

    const slots = within(await bar()).getByRole("navigation", { name: "Site" });
    expect(within(slots).getByRole("link", { name: "Campaigns" })).toHaveAttribute(
      "href",
      "/campaigns"
    );
    expect(within(slots).getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(await bar()).toHaveTextContent("Before the battle");
  });
});

describe("the web bar off the overview", () => {
  it("prompts you back to your battle, and nothing of it is left in the page", async () => {
    fakeApi.on(OPEN, [IN_BATTLE]);
    renderApp(`${BASE}/house-rules`);

    const header = await bar();
    const battle = await within(header).findByRole("status", { name: "Your battle" });
    expect(within(battle).getByText("In battle")).toBeInTheDocument();
    expect(within(battle).getByText("Street Fight, Battle 6")).toBeInTheDocument();
    expect(within(battle).getByRole("link", { name: "Rejoin" })).toHaveAttribute(
      "href",
      `${BASE}/battles/31/active`
    );
    expect(screen.getAllByRole("status", { name: "Your battle" })).toHaveLength(1);
  });

  it("puts your battle before Raise your warband", async () => {
    fakeApi.on(MINE, []);
    fakeApi.on(OPEN, [IN_BATTLE]);
    renderApp(`${BASE}/house-rules`);

    await within(await bar()).findByRole("status", { name: "Your battle" });
    expect(screen.queryByText("None in this campaign yet")).toBeNull();
    expect(screen.queryByText("You have no warband in this campaign.")).toBeNull();
  });

  it("prompts you to raise a warband when you have none, in the bar only", async () => {
    fakeApi.on(MINE, []);
    renderApp(`${BASE}/house-rules`);

    const header = await bar();
    expect(await within(header).findByText("None in this campaign yet")).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Raise your warband" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Raise your warband" })).toHaveLength(1);
  });

  it("says an archived campaign is read-only", async () => {
    fakeApi.on(`GET ${BASE}/`, campaignSummary({ archived_at: "2026-10-30T18:00:00Z" }));
    renderApp(`${BASE}/house-rules`);

    expect(await within(await bar()).findByText("Read-only for everyone")).toBeInTheDocument();
  });

  it("names the campaign and the page with nothing more urgent", async () => {
    renderApp(`${BASE}/house-rules`);
    await waitFor(() => expect(fakeApi.calls()).toContain(OPEN));

    const header = await bar();
    await waitFor(() => expect(header).toHaveTextContent(campaignSummary().name));
    expect(header).toHaveTextContent("House rules");
    expect(within(header).queryByRole("status")).toBeNull();
  });
});

describe("the web bar on the overview", () => {
  it("holds Between battles, all players, even while you are in a battle", async () => {
    fakeApi.on(OPEN, [IN_BATTLE]);
    renderApp(BASE);

    const ready = await within(await bar()).findByRole("region", { name: "Who is ready" });
    expect(ready).toHaveTextContent("Between battles");
    expect(ready).toHaveTextContent("You");
    expect(ready).toHaveTextContent("Mira");
    // the way back is the overview's Start battle, which reads Rejoin
    expect(await screen.findByRole("link", { name: "Rejoin" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Your battle" })).toBeNull();
  });

  it("leaves Raise your warband in the page when you have no warband", async () => {
    fakeApi.on(MINE, []);
    renderApp(BASE);

    const header = await bar();
    await within(header).findByRole("region", { name: "Who is ready" });
    const raise = await screen.findByRole("link", { name: "Raise your warband" });
    expect(header).not.toContainElement(raise);
    expect(raise).toHaveAttribute("href", `${BASE}/warband`);
  });
});
