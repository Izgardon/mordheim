/**
 * The Start battle dialog refuses players who are in another open battle (decision 1 changes this
 * to "greyed out but selectable, with a warning").
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const busyMira = player(9, "Mira", "Night Razors", 140, "active");
const bors = player(12, "Bors", "Grey Wardens", 150);

function renderDialog(players: CampaignPlayer[]) {
  const onBattleCreated = vi.fn();
  render(
    <StartBattleDialog
      open
      onOpenChange={vi.fn()}
      campaignId={1}
      creatorUserId={me.id}
      players={players}
      onBattleCreated={onBattleCreated}
    />
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

  it("disables a player who is in another battle, so they can't be invited (BUG-10, decision 1, pinned; flips in PR C)", async () => {
    const user = setupUser();
    fakeApi.on("POST /campaigns/1/battles/", { battle: { id: 41 }, participants: [], events: [] });
    const { onBattleCreated } = renderDialog([me, busyMira, bors]);

    const mira = rowOf("Mira");
    expect(mira.nameButton).toHaveTextContent("In active battle");
    expect(mira.nameButton).toBeDisabled();
    expect(mira.tick).toBeDisabled();
    await user.click(mira.tick);
    expect(mira.tick).not.toBeChecked();

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
          participant_user_ids: [bors.id, me.id],
          participant_ratings: { "12": 150, "7": 120 },
        },
      },
    ]);
  });

  it("can't create a battle at all while every other player is busy (BUG-10, decision 1, pinned; flips in PR C)", async () => {
    const user = setupUser();
    renderDialog([me, busyMira]);

    await user.type(screen.getByPlaceholderText("Breakthrough at the Old Gate..."), "Ambush");

    expect(screen.getByRole("button", { name: "Create battle" })).toBeDisabled();
    expect(fakeApi.calls()).toEqual([]);
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

  it("lets a busy player be picked when reporting a result instead", async () => {
    const user = setupUser();
    renderDialog([me, busyMira, bors]);

    await user.click(screen.getByRole("button", { name: "Report" }));
    await user.click(rowOf("Mira").tick);

    expect(rowOf("Mira").tick).toBeChecked();
  });
});
