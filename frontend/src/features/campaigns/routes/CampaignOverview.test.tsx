/**
 * The campaign overview as the app mounts it (layout, realtime provider, fake server): what it
 * shows, who is offered Start campaign and what starting does, the hidden bulletin tab, the
 * requests a roster expand sends, and what the layout around it shows and listens to.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { battleState } from "@/test/battle-fixtures";
import {
  ADMIN,
  NAMELESS,
  OWNER,
  PLAYER,
  campaignApi,
  campaignFor,
  campaignSummary,
  patchedCampaign,
  pendingResultRow,
  routeCampaignShell,
  routeOverviewLists,
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
const auth = vi.hoisted(() => ({
  user: { id: 7, email: "aldric@example.com" },
  signOut: () => undefined,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const CAMPAIGN_ROUTE = `GET ${campaignApi()}`;
const PATCH_CAMPAIGN = `PATCH ${campaignApi()}`;

const signInAs = (person: { id: number; email: string }) => {
  auth.user = { id: person.id, email: person.email };
};

/** Renders `/campaigns/1` and waits for the roster to arrive. */
async function openOverview(path = "/campaigns/1") {
  renderCampaignRoute(path);
  expect(await screen.findByRole("heading", { name: "Roster (4 / 8)" })).toBeInTheDocument();
  await screen.findByRole("button", { name: /Aldric/ });
}

const startCampaignButton = () => screen.queryByRole("button", { name: "Start campaign" });

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  signInAs(OWNER);
  routeOverviewLists();
});

describe("CampaignOverview on a started campaign", () => {
  it("shows the roster, battle history, moments and trades, with pass 3's battle button, unfinished-battle banner and results card", async () => {
    routeCampaignShell();
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000 - 3_600_000).toISOString();
    fakeApi.on(`GET ${campaignApi("battles/?open=1")}`, [
      {
        ...battleState({ status: "active", last_activity_at: threeDaysAgo }),
        viewer: { participant_status: "in_battle", unfinished: true, page: "active" },
      },
    ]);
    fakeApi.on(`GET ${campaignApi("battles/pending-results/")}`, [pendingResultRow()]);

    await openOverview();

    expect(screen.getByRole("heading", { name: "Battle History" })).toBeInTheDocument();
    expect(screen.getAllByText("Skirmish at the Market Square").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Black Fang falls in the market").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Trades" })).toBeInTheDocument();
    // Pass 3's battle UI renders where the overview shows it; its behaviour is tested there.
    expect(await screen.findByRole("button", { name: "Rejoin Battle" })).toBeInTheDocument();
    expect(screen.getByText(/You have an unfinished battle/)).toHaveTextContent(
      "You have an unfinished battle: #5, active, idle 3 days. Go to it"
    );
    expect(
      await screen.findByRole("region", { name: "Results awaiting your approval" })
    ).toHaveTextContent("Ambush at the Bridge");
    expect(startCampaignButton()).not.toBeInTheDocument();
  });

  it("shows a nameless member by the server's display name, never an email (SEC-13)", async () => {
    routeCampaignShell();

    await openOverview();

    const row = screen.getByRole("button", { name: new RegExp(NAMELESS.name) });
    expect(row).toHaveTextContent("Player 12");
    expect(row).toHaveTextContent("Unassigned");
    expect(screen.queryByText(/@example\.com/)).not.toBeInTheDocument();
  });

  it("expands a roster row with three list requests, one per unit kind (PERF-42, pinned; flips in PR A)", async () => {
    const user = setupUser();
    routeCampaignShell();
    const warbandId = PLAYER.warband!.id;
    fakeApi.on(`GET /warbands/${warbandId}/heroes/`, [
      {
        id: 2,
        name: "Black Fang",
        unit_type: "Assassin Adept",
        movement: 6,
        weapon_skill: 4,
        ballistic_skill: 3,
        strength: 4,
        toughness: 3,
        wounds: 1,
        initiative: 5,
        attacks: 1,
        leadership: 7,
        armour_save: null,
      },
    ]);
    fakeApi.on(`GET /warbands/${warbandId}/henchmen-groups/`, []);
    fakeApi.on(`GET /warbands/${warbandId}/hired-swords/`, []);
    await openOverview();
    fakeApi.clearRequests();

    const row = screen.getByRole("button", { name: /Mira/ });
    await user.click(row);

    expect(await screen.findByText("Black Fang")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual([
      `GET /warbands/${warbandId}/heroes/`,
      `GET /warbands/${warbandId}/henchmen-groups/`,
      `GET /warbands/${warbandId}/hired-swords/`,
    ]);

    // Folding and unfolding again reuses what this mount loaded.
    await user.click(row);
    await user.click(row);
    expect(await screen.findByText("Black Fang")).toBeInTheDocument();
    expect(fakeApi.calls()).toHaveLength(3);
  });
});

describe("CampaignOverview tabs", () => {
  it("shows the Overview tab alone; ?tab=bulletin opens the bulletin while the header says Overview (CAMP-UX-05, pinned; flips in PR C)", async () => {
    routeCampaignShell();
    fakeApi.on(`GET ${campaignApi("bulletin/")}`, [
      {
        id: 1,
        campaign_id: 1,
        user_id: PLAYER.id,
        username: PLAYER.name,
        body: "Wanted: one rope, slightly used.",
        created_at: "2026-10-18T12:00:00Z",
      },
    ]);
    fakeApi.on(`GET ${campaignApi("top-killers/")}`, { top_killers: [] });

    renderCampaignRoute("/campaigns/1?tab=bulletin");

    expect(await screen.findByRole("heading", { name: "Bulletin Board" })).toBeInTheDocument();
    expect(await screen.findByText("Wanted: one rope, slightly used.")).toBeInTheDocument();
    const header = screen.getByRole("banner");
    const tabs = within(header).getAllByRole("button");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Overview"]);
    expect(tabs[0]).toHaveAttribute("data-active", "true");
    expect(screen.queryByRole("heading", { name: /^Roster/ })).not.toBeInTheDocument();
  });

  it("loads the bulletin and top killers only through ?tab=bulletin, never on the plain overview", async () => {
    routeCampaignShell();

    await openOverview();

    expect(fakeApi.countOf(`GET ${campaignApi("bulletin/")}`)).toBe(0);
    expect(fakeApi.countOf(`GET ${campaignApi("top-killers/")}`)).toBe(0);
    expect(screen.queryByRole("heading", { name: "Bulletin Board" })).not.toBeInTheDocument();
  });
});

describe("Start campaign", () => {
  it("is offered to the owner before the start, saying it locks in the roster (BUG-77, pinned; flips in PR A)", async () => {
    const user = setupUser();
    routeCampaignShell({ campaign: campaignSummary({ in_progress: false }) });
    await openOverview();

    await user.click(startCampaignButton()!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Start the campaign now? This will lock in the roster.");
    expect(dialog).toHaveTextContent(
      "Before starting, make sure all Campaign Settings locations are set for items"
    );
    expect(within(dialog).getByRole("button", { name: "Confirm start" })).toBeEnabled();
  });

  it("hides the whole battle panel before the start: no Start battle, banner or results card (decision 3, BUG-77, pinned; flips in PR A)", async () => {
    routeCampaignShell({ campaign: campaignSummary({ in_progress: false }) });
    fakeApi.on(`GET ${campaignApi("battles/pending-results/")}`, [pendingResultRow()]);

    await openOverview();

    expect(startCampaignButton()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start battle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Results awaiting/ })).not.toBeInTheDocument();
    expect(fakeApi.countOf(`GET ${campaignApi("battles/pending-results/")}`)).toBe(0);
  });

  it("PATCHes in_progress and shows Start battle; leaving and coming back brings Start campaign back and hides Start battle (BUG-14, CAMP-TEST-07 baseline, pinned; flips in PR A)", async () => {
    const user = setupUser();
    const campaign = campaignSummary({ in_progress: false });
    routeCampaignShell({ campaign });
    fakeApi.on(PATCH_CAMPAIGN, (body: unknown) => patchedCampaign(campaign, body));
    await openOverview();

    await user.click(startCampaignButton()!);
    await user.click(screen.getByRole("button", { name: "Confirm start" }));

    expect(await screen.findByRole("button", { name: "Start battle" })).toBeInTheDocument();
    expect(startCampaignButton()).not.toBeInTheDocument();
    expect(fakeApi.requests().filter((request) => request.method === "PATCH")).toEqual([
      { method: "PATCH", path: campaignApi(), body: { in_progress: true } },
    ]);

    // The store's copy (the XP bar's gate) says started while away from the overview...
    await user.click(screen.getByRole("link", { name: "Skills" }));
    expect(await screen.findByText("XP tracking: on")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Campaign" }));
    await screen.findByRole("heading", { name: "Roster (4 / 8)" });

    // ...but the PATCH answer never reached the cached campaign, which the overview reads again.
    expect(startCampaignButton()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start battle" })).not.toBeInTheDocument();
    expect(fakeApi.countOf(CAMPAIGN_ROUTE)).toBe(1);
  });

  it("is offered to an admin, whose confirm the server refuses with 403 (BUG-13, pinned; flips in PR A)", async () => {
    const user = setupUser();
    signInAs(ADMIN);
    routeCampaignShell({
      campaign: campaignFor("admin", { in_progress: false }),
      viewer: ADMIN,
    });
    fakeApi.fail(PATCH_CAMPAIGN, new ApiError("Forbidden", 403, { detail: "Forbidden" }));
    await openOverview();

    await user.click(startCampaignButton()!);
    await user.click(screen.getByRole("button", { name: "Confirm start" }));

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Forbidden")).toBeInTheDocument();
    expect(fakeApi.bodyOf(PATCH_CAMPAIGN)).toEqual({ in_progress: true });
    expect(screen.queryByRole("button", { name: "Start battle" })).not.toBeInTheDocument();
  });

  it("is not offered to a player", async () => {
    signInAs(PLAYER);
    routeCampaignShell({
      campaign: campaignFor("player", { in_progress: false }),
      viewer: PLAYER,
    });

    await openOverview();

    expect(startCampaignButton()).not.toBeInTheDocument();
  });

  it("waits for the server: a refused start leaves the button and Start battle hidden", async () => {
    const user = setupUser();
    routeCampaignShell({ campaign: campaignSummary({ in_progress: false }) });
    fakeApi.fail(PATCH_CAMPAIGN, new ApiError("Request failed (500)", 500, null));
    await openOverview();

    await user.click(startCampaignButton()!);
    await user.click(screen.getByRole("button", { name: "Confirm start" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent("Request failed (500)")
    );
    expect(screen.queryByRole("button", { name: "Start battle" })).not.toBeInTheDocument();
  });
});

describe("CampaignLayout around the overview", () => {
  it("lists Locations and Encampments in the side rail only when each is switched on", async () => {
    routeCampaignShell({ campaign: campaignSummary({ enable_locations: true }) });

    await openOverview();

    expect(screen.getByRole("link", { name: "Locations" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Encampments" })).not.toBeInTheDocument();
  });

  it("shows the server's answer instead of the page when the campaign can't be read", async () => {
    routeCampaignShell();
    fakeApi.fail(CAMPAIGN_ROUTE, new ApiError("Not found", 404, { detail: "Not found" }));

    renderCampaignRoute("/campaigns/1");

    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(fakeApi.countOf(`GET ${campaignApi("players/")}`)).toBe(0);
  });

  it("listens to the campaign's chat and your notifications only: nothing tells it about a start, a toggle or a role change made elsewhere (CAMP-UX-04, CAMP-NEW-07, pinned; flips in PR C)", async () => {
    routeCampaignShell();

    await openOverview();

    await waitFor(() =>
      expect(fakeRealtime.channels()).toEqual([
        "private-campaign-1-chat",
        `private-user-${OWNER.id}-notifications`,
      ])
    );
  });
});
