/**
 * The Battles page's caption: while the rows load it is a skeleton like theirs, never "0 battles
 * fought" (the bounties brief); once they are in it counts them. At its top Start battle, or the
 * way to your battle (William), and your open battles listed when you have several.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BattleViewer } from "@/features/battles/types/battle-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import Battles from "./Battles";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
// what waits on you sits above the rows and has its own tests
vi.mock("../components/overview/OverviewNotices", () => ({ default: () => null }));

const battle = (id: number) => ({
  id,
  scenario: "Street Fight",
  winners: ["Rats"],
  date: "01/11/26",
  participants: [],
  moments: [],
});

function renderBattles() {
  const context = {
    campaign: campaignSummary(),
    setBattleMenuActions: () => {},
    openTool: () => {},
    openBattleDialog: () => {},
  };
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[`/campaigns/${CAMPAIGN_ID}/battles`]}>
      <Routes>
        <Route path="/campaigns/:id" element={<Outlet context={context} />}>
          <Route path="battles" element={<Battles />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  fakeApi.reset();
});

describe("the Battles page's caption", () => {
  it("is a skeleton while the battles load, not a count of none", () => {
    renderBattles(); // battle-history/ never answers

    expect(screen.getByRole("status", { name: "Loading the battles" })).toBeInTheDocument();
    expect(screen.queryByText(/battles fought/)).not.toBeInTheDocument();
  });

  it("counts the battles once they are in", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/battle-history/`, [battle(1), battle(2)]);
    renderBattles();

    expect(await screen.findByText("2 battles fought")).toBeInTheDocument();
  });
});

const BASE = `/campaigns/${CAMPAIGN_ID}`;

/** One of your open battles, as `battles/?open=1` lists it. */
const openBattle = (id: number, scenario: string, viewer: BattleViewer) => ({
  battle: {
    id,
    campaign_id: CAMPAIGN_ID,
    status: viewer.page === "active" ? "active" : "prebattle",
    flow_type: "normal",
    scenario,
    number: id - 30,
  },
  participants: [{ user: { id: RAIDER.id }, status: viewer.participant_status }],
  viewer,
});
const FIGHT = openBattle(31, "Street Fight", {
  participant_status: "in_battle",
  unfinished: true,
  page: "active",
});
const INVITE = openBattle(32, "Ambush", {
  participant_status: "invited",
  unfinished: true,
  page: "prebattle",
});

describe("the Battles page's battle button and open battles", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeRealtime.reset();
    storeSession(RAIDER);
    fakeApi.on("GET /auth/me/", RAIDER);
    fakeApi.on("GET /notifications/", []);
    fakeApi.on(`GET ${BASE}/`, campaignSummary());
    fakeApi.on(`GET ${BASE}/players/`, []);
    fakeApi.on(`GET ${BASE}/battle-history/`, []);
  });

  afterEach(() => {
    cleanupApps();
  });

  const page = async () =>
    (await screen.findByRole("heading", { name: "Battles" })).closest("header");

  it("starts a battle when you have none", async () => {
    fakeApi.on(`GET ${BASE}/battles/?open=1`, []);
    const user = setupUser();
    renderApp(`${BASE}/battles`);
    await waitFor(() => expect(fakeApi.calls()).toContain(`GET ${BASE}/battles/?open=1`));

    await user.click(within((await page())!).getByRole("button", { name: "Start battle" }));

    expect(await screen.findByRole("dialog", { name: "Start a battle" })).toBeInTheDocument();
  });

  it("reads Rejoin and goes to your battle when you have one, with no list", async () => {
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [FIGHT]);
    renderApp(`${BASE}/battles`);

    const header = (await page())!;
    expect(await within(header).findByRole("link", { name: "Rejoin" })).toHaveAttribute(
      "href",
      `${BASE}/battles/31/active`
    );
    expect(screen.queryByRole("heading", { name: "Your open battles" })).toBeNull();
  });

  it("lists your open battles when you have several, an invitation with Accept and Decline", async () => {
    // the newer invitation comes first in the list; your fight needs you more
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [INVITE, FIGHT]);
    fakeApi.on(`POST ${BASE}/battles/32/decline/`, {
      ...INVITE,
      participants: [{ user: { id: RAIDER.id }, status: "declined" }],
    });
    const user = setupUser();
    renderApp(`${BASE}/battles`);

    const list = (await screen.findByRole("heading", { name: "Your open battles" })).closest(
      "section"
    )!;
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Street Fight, Battle 1In the fightRejoin"),
      expect.stringContaining("Ambush, Battle 2Invited"),
    ]);
    expect(within(rows[0]).getByRole("link", { name: "Rejoin" })).toHaveAttribute(
      "href",
      `${BASE}/battles/31/active`
    );
    expect(within((await page())!).getByRole("link", { name: "Rejoin" })).toBeInTheDocument();
    expect(within(rows[1]).getByRole("button", { name: "Accept" })).toBeInTheDocument();

    fakeApi.on(`GET ${BASE}/battles/?open=1`, [FIGHT]);
    await user.click(within(rows[1]).getByRole("button", { name: "Decline" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Your open battles" })).toBeNull()
    );
    expect(fakeApi.countOf(`POST ${BASE}/battles/32/decline/`)).toBe(1);
  });

  it("says what accepting an invitation clears, beside its Accept", async () => {
    const own = openBattle(33, "Raid", {
      participant_status: "joined_prebattle",
      unfinished: true,
      page: "prebattle",
    });
    const asked = openBattle(34, "Ambush", {
      participant_status: "joined_prebattle",
      unfinished: true,
      page: "prebattle",
    });
    const invite = {
      ...INVITE,
      viewer: {
        ...INVITE.viewer,
        accepting_clears: [
          { battle_id: 33, outcome: "cancel" },
          { battle_id: 34, outcome: "withdraw" },
        ],
      },
    };
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [invite, own, asked]);
    renderApp(`${BASE}/battles`);

    const list = (await screen.findByRole("heading", { name: "Your open battles" })).closest(
      "section"
    )!;
    const row = within(list).getByText("Ambush, Battle 2").closest("li")!;
    expect(row).toHaveTextContent(
      "Accepting withdraws you from Ambush, Battle 4 and cancels your Raid, Battle 3."
    );
    expect(within(list).getByText("Raid, Battle 3").closest("li")).not.toHaveTextContent(
      "Accepting"
    );
  });

  it("accepting an invitation whose pre-battle is open goes there", async () => {
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [INVITE, FIGHT]);
    fakeApi.on(`POST ${BASE}/battles/32/join/`, {
      ...INVITE,
      battle: { ...INVITE.battle, status: "prebattle" },
      participants: [{ user: { id: RAIDER.id }, status: "accepted" }],
    });
    const user = setupUser();
    const app = renderApp(`${BASE}/battles`);

    await user.click(await screen.findByRole("button", { name: "Accept" }));

    await waitFor(() => expect(app.location().pathname).toBe(`${BASE}/battles/32/prebattle`));
  });
});
