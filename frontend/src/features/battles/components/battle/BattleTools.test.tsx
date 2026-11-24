/**
 * The battle's tools (William, 24 Nov 2026): on a phone Dice sits in the middle of the bar and
 * Ranged takes its old place, and Dice opens the campaign's own dice roller (the one its header's
 * dice button opens on every page) rather than a battle-only roller.
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import BattleTools from "./BattleTools";

function renderTools(isMobile: boolean) {
  const openTool = vi.fn();
  const onOpen = vi.fn();
  const context = {
    campaign: null,
    setBattleMenuActions: () => {},
    openTool,
    openBattleDialog: () => {},
  };
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={context} />}>
          <Route path="*" element={<BattleTools isMobile={isMobile} onOpen={onOpen} />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  return { openTool, onOpen };
}

const labels = (container: HTMLElement) =>
  within(container)
    .getAllByRole("button")
    .map((button) => button.textContent?.trim());

describe("BattleTools", () => {
  it("puts Dice in the middle of the phone's bar, Ranged where Dice was", () => {
    renderTools(true);

    expect(labels(screen.getByRole("navigation", { name: "Battle tools" }))).toEqual([
      "Rules",
      "Melee",
      "Dice",
      "Ranged",
      "Menu",
    ]);
  });

  it("opens the campaign's dice roller from Dice, on a phone and on the web", async () => {
    const user = setupUser();
    const phone = renderTools(true);
    await user.click(screen.getByRole("button", { name: "Dice" }));
    expect(phone.openTool).toHaveBeenCalledWith("dice");
    expect(phone.onOpen).not.toHaveBeenCalled();
  });

  it("opens the main roller from the web toolbar too, and the rest on the battle screen", async () => {
    const user = setupUser();
    const web = renderTools(false);

    await user.click(screen.getByRole("button", { name: "Dice" }));
    await user.click(screen.getByRole("button", { name: "Ranged" }));

    expect(web.openTool).toHaveBeenCalledWith("dice");
    expect(web.onOpen).toHaveBeenCalledWith("ranged");
  });
});
