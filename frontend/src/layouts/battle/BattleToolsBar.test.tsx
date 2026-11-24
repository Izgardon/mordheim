/** The phone's battle bar before the fight reads as the battle screen's: Dice in the middle. */
import { render, screen, within } from "@testing-library/react";
import { setupUser } from "@/test/user-event";
import { describe, expect, it, vi } from "vitest";

import BattleToolsBar from "./BattleToolsBar";

describe("BattleToolsBar", () => {
  it("puts Dice in the middle and Ranged where Dice was (William, 24 Nov 2026)", () => {
    render(<BattleToolsBar actions={[]} onOpenTool={vi.fn()} onExit={vi.fn()} />);

    const bar = screen.getByRole("navigation", { name: "Battle tools" });
    expect(
      within(bar)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Rules", "Melee", "Dice", "Ranged", "Menu"]);
  });

  it("shows the Misfire chart in Ranged, and not in Melee", async () => {
    const user = setupUser();
    render(<BattleToolsBar actions={[]} onOpenTool={vi.fn()} onExit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Ranged" }));
    expect(screen.getByRole("region", { name: "Blackpowder Weapons" })).toHaveTextContent(
      "Misfire chart · Blackpowder Weapons"
    );
  });

  it("leaves the Misfire chart out of Melee", async () => {
    const user = setupUser();
    render(<BattleToolsBar actions={[]} onOpenTool={vi.fn()} onExit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Melee" }));
    expect(screen.queryByText("Misfire chart · Blackpowder Weapons")).toBeNull();
  });
});
