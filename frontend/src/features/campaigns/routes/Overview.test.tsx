/**
 * The overview's Start battle and Report a result, on the real routes over the fake API server:
 * they open the one dialog the campaign layout holds, with the campaign's players to pick from.
 * While you are in a battle, Start battle reads Rejoin and goes there (William), and Start a
 * battle stays in the ⋯ menu unless you are fighting it; a player fighting a battle can't be
 * picked (one battle at a time).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignPlayer } from "@/features/campaigns/types/campaign-types";
import { ApiError } from "@/lib/api-client";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/campaigns/routes/Overview";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const BASE = `/campaigns/${CAMPAIGN_ID}`;

const player = (id: number, name: string, warband: string): CampaignPlayer => ({
  id,
  name,
  warband: { id: id + 100, name: warband, type_name: "Reiklanders", wins: 0, losses: 0 },
});
const PLAYERS = [player(RAIDER.id, "Raider", "Iron Vultures"), player(9, "Mira", "Night Razors")];

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${BASE}/`, campaignSummary());
  fakeApi.on(`GET ${BASE}/players/`, PLAYERS);
  fakeApi.on(`GET ${BASE}/battle-history/`, []);
  fakeApi.on(`GET ${BASE}/battles/?open=1`, []);
});

afterEach(() => {
  cleanupApps();
});

describe("the overview's battle buttons", () => {
  it("Start battle opens Start a battle, the campaign's players listed", async () => {
    const user = setupUser();
    renderApp(BASE);

    await user.click(await screen.findByRole("button", { name: "Start battle" }));

    const dialog = await screen.findByRole("dialog", { name: "Start a battle" });
    expect(within(dialog).getByText("You · Iron Vultures")).toBeInTheDocument();
    expect(within(dialog).getByText("Mira · Night Razors")).toBeInTheDocument();
  });

  it("Report a result opens Report a result", async () => {
    const user = setupUser();
    renderApp(BASE);

    await user.click(await screen.findByRole("button", { name: "Report a result" }));

    expect(await screen.findByRole("dialog", { name: "Report a result" })).toBeInTheDocument();
  });
});

/** Battle 31, in its fight, and you in it. */
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

describe("the overview's Start battle while you are in a battle", () => {
  beforeEach(() => {
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [IN_BATTLE]);
  });

  it("reads Rejoin and goes to your battle, Report a result unchanged", async () => {
    const user = setupUser();
    const app = renderApp(BASE);

    const rejoin = await screen.findByRole("link", { name: "Rejoin" });
    expect(screen.queryByRole("button", { name: "Start battle" })).toBeNull();
    expect(screen.getByRole("button", { name: "Report a result" })).toBeInTheDocument();
    expect(screen.queryByText(/You have an unfinished battle/)).toBeNull();

    await user.click(rejoin);

    expect(app.location().pathname).toBe(`${BASE}/battles/31/active`);
  });

  it("offers no other battle from the ⋯ menu while you fight (one battle at a time)", async () => {
    const user = setupUser();
    renderApp(BASE);
    await screen.findByRole("link", { name: "Rejoin" });

    await user.click(screen.getByRole("button", { name: "More campaign actions" }));

    expect(await screen.findByRole("menuitem", { name: "Campaign settings" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Start another battle" })).toBeNull();
  });
});

describe("the overview's Start battle while you are in a pre-battle", () => {
  it("keeps Start a battle in reach from the ⋯ menu", async () => {
    const prebattle = {
      ...IN_BATTLE,
      battle: { ...IN_BATTLE.battle, status: "prebattle" },
      participants: [{ user: { id: RAIDER.id }, status: "joined_prebattle" }],
      viewer: { participant_status: "joined_prebattle", unfinished: true, page: "prebattle" },
    };
    fakeApi.on(`GET ${BASE}/battles/?open=1`, [prebattle]);
    const user = setupUser();
    renderApp(BASE);
    await screen.findByRole("link", { name: "Back to pre-battle" });

    await user.click(screen.getByRole("button", { name: "More campaign actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Start another battle" }));

    expect(await screen.findByRole("dialog", { name: "Start a battle" })).toBeInTheDocument();
  });
});

describe("Start a battle's players", () => {
  const busy = (id: number, name: string, fields: Partial<CampaignPlayer>): CampaignPlayer => ({
    ...player(id, name, `${name}'s band`),
    battle_busy: true,
    battle_busy_battle_number: 6,
    ...fields,
  });

  beforeEach(() => {
    fakeApi.on(`GET ${BASE}/players/`, [
      ...PLAYERS,
      busy(10, "Olga", { battle_busy_participant_status: "in_battle", battle_fighting: true }),
      busy(11, "Pia", { battle_busy_participant_status: "invited" }),
      busy(12, "Rex", { battle_busy_participant_status: "finished_battle" }),
    ]);
  });

  const row = (dialog: HTMLElement, text: string) =>
    within(dialog).getByText(text).closest("label") as HTMLElement;

  it("can't pick a player fighting a battle; one in a pre-battle or a post-game can be", async () => {
    const user = setupUser();
    renderApp(BASE);
    await user.click(await screen.findByRole("button", { name: "Start battle" }));
    const dialog = await screen.findByRole("dialog", { name: "Start a battle" });

    const olga = row(dialog, "Olga · Olga's band");
    expect(within(olga).getByRole("checkbox")).toBeDisabled();
    expect(olga).toHaveTextContent("In battle 6");
    expect(row(dialog, "Pia · Pia's band")).toHaveTextContent("Pre-battle");
    expect(row(dialog, "Rex · Rex's band")).toHaveTextContent("Post-game");
    await user.click(within(row(dialog, "Pia · Pia's band")).getByRole("checkbox"));
    expect(within(row(dialog, "Pia · Pia's band")).getByRole("checkbox")).toBeChecked();
  });

  it("can name him in a result already played", async () => {
    const user = setupUser();
    renderApp(BASE);
    await user.click(await screen.findByRole("button", { name: "Report a result" }));
    const dialog = await screen.findByRole("dialog", { name: "Report a result" });

    const olga = row(dialog, "Olga · Olga's band");
    expect(within(olga).getByRole("checkbox")).toBeEnabled();
    expect(olga).toHaveTextContent("In battle 6");
  });

  it("shows the server's refusal when a player's fight began meanwhile", async () => {
    const detail = "Mira is already fighting in Battle 7.";
    fakeApi.fail(
      `POST ${BASE}/battles/`,
      new ApiError(detail, 400, { detail, code: "player_in_battle" })
    );
    const user = setupUser();
    renderApp(BASE);
    await user.click(await screen.findByRole("button", { name: "Start battle" }));
    const dialog = await screen.findByRole("dialog", { name: "Start a battle" });
    await user.type(within(dialog).getByLabelText("Scenario"), "Ambush");
    await user.click(within(row(dialog, "Mira · Night Razors")).getByRole("checkbox"));
    const reads = fakeApi.countOf(`GET ${BASE}/players/`);

    await user.click(within(dialog).getByRole("button", { name: "Start battle" }));

    expect(await within(dialog).findByText(detail)).toBeInTheDocument();
    // the players are read again, so she shows as fighting
    await waitFor(() => expect(fakeApi.countOf(`GET ${BASE}/players/`)).toBe(reads + 1));
  });
});
