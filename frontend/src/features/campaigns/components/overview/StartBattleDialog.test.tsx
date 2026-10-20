/**
 * The Start battle dialog: players in another open battle are greyed out but can be invited, with
 * a warning, and the create answer's warnings show as toasts (BUG-10, decision 1).
 */
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppToaster } from "@/components/ui/toaster";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { battleState } from "@/test/battle-fixtures";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { setupUser } from "@/test/user-event";
import type { CampaignPlayer } from "../../types/campaign-types";
import StartBattleDialog from "./StartBattleDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const player = (
  id: number,
  name: string,
  warbandName: string,
  rating: number,
  busy: CampaignPlayer["battle_busy_status"] = null
): CampaignPlayer => ({
  id,
  name,
  battle_busy: Boolean(busy),
  battle_busy_status: busy,
  warband: { id: id * 10, name: warbandName, faction: "Mercenaries", wins: 0, losses: 0, rating },
});

const me = player(7, "Owner", "Iron Vultures", 120);
const busyMira: CampaignPlayer = {
  ...player(9, "Mira", "Night Razors", 140, "active"),
  battle_busy_battle_id: 40,
  battle_busy_last_activity_at: new Date(Date.now() - 6 * 86_400_000 - 60_000).toISOString(),
};
const bors = player(12, "Bors", "Grey Wardens", 150);

/** The overview has the open battles cached already (the Rejoin button reads them). */
const withOpenBattles = () => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.campaign.openBattles(1), []);
  return queryClient;
};

function renderDialog(players: CampaignPlayer[], queryClient = withOpenBattles()) {
  const onBattleCreated = vi.fn();
  renderWithQueryClient(
    <MemoryRouter>
      <StartBattleDialog
        open
        onOpenChange={vi.fn()}
        campaignId={1}
        creatorUserId={me.id}
        players={players}
        onBattleCreated={onBattleCreated}
      />
      <AppToaster />
    </MemoryRouter>,
    { queryClient }
  );
  return { onBattleCreated };
}

/** A player's row: the name button and the tick next to it. */
const rowOf = (name: string) => {
  const nameButton = screen.getByRole("button", { name: new RegExp(`^${name}`) });
  const rowElement = nameButton.parentElement as HTMLElement;
  return { nameButton, tick: rowElement.querySelector("input[type=checkbox]") as HTMLElement };
};

describe("StartBattleDialog", () => {
  beforeEach(() => {
    fakeApi.reset();
  });

  it("greys out a player in another battle but lets them be invited, with a warning (BUG-10, decision 1)", async () => {
    const user = setupUser();
    fakeApi.on("POST /campaigns/1/battles/", {
      battle: { id: 41 },
      participants: [],
      events: [],
      warnings: [
        {
          code: "player_busy",
          message: "Mira is in an unfinished battle (#40, active).",
          user_id: 9,
        },
      ],
    });
    const { onBattleCreated } = renderDialog([me, busyMira, bors]);

    const mira = rowOf("Mira");
    expect(mira.nameButton).toHaveTextContent("In battle #40 (active), idle 6 days");
    expect(mira.nameButton.parentElement).toHaveClass("opacity-60");
    expect(mira.nameButton).toBeEnabled();
    await user.click(mira.tick);
    expect(mira.tick).toBeChecked();
    expect(
      screen.getByText(/Mira is in battle #40 \(active\), idle 6 days\. You can still invite them/)
    ).toBeInTheDocument();

    await user.click(rowOf("Bors").tick);
    await user.type(screen.getByPlaceholderText("Breakthrough at the Old Gate..."), "Ambush");
    await user.click(screen.getByRole("button", { name: "Create battle" }));

    await waitFor(() => expect(onBattleCreated).toHaveBeenCalled());
    expect(fakeApi.requests()).toEqual([
      {
        method: "POST",
        path: "/campaigns/1/battles/",
        body: {
          scenario: "Ambush",
          scenario_link: null,
          participant_user_ids: [busyMira.id, bors.id, me.id],
          participant_ratings: { "9": 140, "12": 150, "7": 120 },
        },
      },
    ]);
    expect(
      await screen.findByText("Mira is in an unfinished battle (#40, active).")
    ).toBeInTheDocument();
  });

  it("creates a battle even when every other player is busy (BUG-10, decision 1)", async () => {
    const user = setupUser();
    renderDialog([me, busyMira]);

    await user.click(rowOf("Mira").tick);
    await user.type(screen.getByPlaceholderText("Breakthrough at the Old Gate..."), "Ambush");

    expect(screen.getByRole("button", { name: "Create battle" })).toBeEnabled();
  });

  it("reports a result with No winner as an empty winner list (decision 8)", async () => {
    const user = setupUser();
    fakeApi.on("POST /campaigns/1/battles/report-result/", {
      battle: { id: 42 },
      participants: [],
      events: [],
    });
    const { onBattleCreated } = renderDialog([me, bors]);

    await user.click(screen.getByRole("button", { name: "Report" }));
    await user.click(rowOf("Bors").tick);
    await user.type(screen.getByPlaceholderText("Skirmish at the Market Square..."), "Ambush");
    const report = screen.getByRole("button", { name: "Submit result" });
    expect(report).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "No winner" }));
    expect(screen.getByText(/Winners: No winner/)).toBeInTheDocument();
    await user.click(report);

    await waitFor(() => expect(onBattleCreated).toHaveBeenCalled());
    expect(fakeApi.bodyOf("POST /campaigns/1/battles/report-result/")).toMatchObject({
      scenario: "Ambush",
      participant_user_ids: expect.arrayContaining([bors.id, me.id]),
      winner_warband_ids: [],
    });
  });

  it("shows a reported result's warnings as toasts, as a created battle's (decision 3)", async () => {
    const user = setupUser();
    fakeApi.on("POST /campaigns/1/battles/report-result/", {
      battle: { id: 42 },
      participants: [],
      events: [],
      warnings: [{ code: "campaign_not_started", message: "The campaign hasn't started yet." }],
    });
    const { onBattleCreated } = renderDialog([me, bors]);

    await user.click(screen.getByRole("button", { name: "Report" }));
    await user.click(rowOf("Bors").tick);
    await user.type(screen.getByPlaceholderText("Skirmish at the Market Square..."), "Ambush");
    await user.click(screen.getByRole("checkbox", { name: "No winner" }));
    await user.click(screen.getByRole("button", { name: "Submit result" }));

    await waitFor(() => expect(onBattleCreated).toHaveBeenCalled());
    expect(await screen.findByText("The campaign hasn't started yet.")).toBeInTheDocument();
  });

  it("lets a busy player be picked when reporting a result instead", async () => {
    const user = setupUser();
    renderDialog([me, busyMira, bors]);

    await user.click(screen.getByRole("button", { name: "Report" }));
    await user.click(rowOf("Mira").tick);

    expect(rowOf("Mira").tick).toBeChecked();
  });

  it("tells you about your unfinished battle, with a link to its page (BATL-NEW-01)", () => {
    const queryClient = createTestQueryClient();
    const unfinished = battleState({
      id: 40,
      status: "postbattle",
      last_activity_at: new Date(Date.now() - 6 * 86_400_000 - 60_000).toISOString(),
    });
    unfinished.viewer = {
      participant_status: "finished_battle",
      unfinished: true,
      page: "postbattle",
    };
    queryClient.setQueryData(queryKeys.campaign.openBattles(1), [unfinished]);
    renderDialog([me, bors], queryClient);

    expect(screen.getByRole("status")).toHaveTextContent(
      "You have an unfinished battle: #40, postbattle, idle 6 days. Go to it"
    );
    expect(screen.getByRole("link", { name: "Go to it" })).toHaveAttribute(
      "href",
      "/campaigns/1/battles/40/postbattle"
    );
  });
});
