/** The phone's battle bar before the fight reads as the battle screen's: Dice in the middle. */
import { screen, within } from "@testing-library/react";
import { setupUser } from "@/test/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";

import BattleToolsBar from "./BattleToolsBar";

const renderBar = () =>
  renderWithQueryClient(
    <BattleToolsBar
      campaignId={1}
      rules={null}
      actions={[]}
      onOpenTool={vi.fn()}
      onExit={vi.fn()}
    />
  );

describe("BattleToolsBar", () => {
  it("puts Dice in the middle and Ranged where Dice was (William, 24 Nov 2026)", () => {
    renderBar();

    const bar = screen.getByRole("navigation", { name: "Battle tools" });
    expect(
      within(bar)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Rules", "Melee", "Dice", "Ranged", "Menu"]);
  });

  it("shows the Misfire chart in Ranged, and not in Melee", async () => {
    const user = setupUser();
    renderBar();

    await user.click(screen.getByRole("button", { name: "Ranged" }));
    expect(screen.getByRole("region", { name: "Blackpowder Weapons" })).toHaveTextContent(
      "Misfire chart · Blackpowder Weapons"
    );
  });

  it("leaves the Misfire chart out of Melee", async () => {
    const user = setupUser();
    renderBar();

    await user.click(screen.getByRole("button", { name: "Melee" }));
    expect(screen.queryByText("Misfire chart · Blackpowder Weapons")).toBeNull();
  });

  // William, 24 Nov 2026: the pre-battle bar's Rules sheet and Menu as the active battle's
  it("opens the battle's five rule pills in Rules", async () => {
    const user = setupUser();
    renderBar();

    await user.click(screen.getByRole("button", { name: "Rules" }));
    const pills = await screen.findByRole("group", { name: "Rules section" });
    expect(
      within(pills)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Battle rules", "Warband rules", "Charts", "House rules", "Rules"]);
  });

  it("gives every Menu row a line saying what it does", async () => {
    const user = setupUser();
    renderBar();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    for (const [label, detail] of [
      ["Chat", "Message the campaign's players"],
      ["Notifications", "Invitations, claims and what the others did"],
      ["Back to the campaign", "The battle waits for you; Rejoin brings you back"],
    ])
      expect(screen.getByRole("button", { name: new RegExp(label) })).toHaveTextContent(detail);
  });
});
