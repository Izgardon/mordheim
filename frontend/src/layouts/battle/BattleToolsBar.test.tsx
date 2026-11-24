/** The phone's battle bar before the fight reads as the battle screen's: Dice in the middle. */
import { render, screen, within } from "@testing-library/react";
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
});
