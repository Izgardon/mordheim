import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BattleResultsDialog, { type ResultsWarband } from "./BattleResultsDialog";

const WARBANDS: ResultsWarband[] = [
  { warbandId: 101, warbandName: "Iron Vultures", playerLabel: "Owner", declared: "won" },
  { warbandId: 102, warbandName: "Night Razors", playerLabel: "Player", declared: "lost" },
  { warbandId: 103, warbandName: "Grey Wolves", playerLabel: "Third", declared: "undecided" },
];

const renderDialog = (onSubmit = vi.fn()) => {
  render(
    <BattleResultsDialog
      open
      onOpenChange={vi.fn()}
      description="Drag each warband."
      warbands={WARBANDS}
      initialWinners={[101]}
      isSubmitting={false}
      error=""
      onSubmit={onSubmit}
    />
  );
  return onSubmit;
};

const column = (name: "Winners" | "Losers") =>
  within(screen.getByRole("region", { name }))
    .queryAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent);

describe("BattleResultsDialog", () => {
  it("starts each warband on its declared side, the undecided among the losers", () => {
    renderDialog();
    expect(column("Winners")).toEqual(["Iron Vultures"]);
    expect(column("Losers")).toEqual(["Night Razors", "Grey Wolves"]);
    expect(screen.getByText("Player · said lost")).toBeInTheDocument();
  });

  it("moves a card with its button, for keyboard and touch, and sends both sides", async () => {
    const user = userEvent.setup();
    const onSubmit = renderDialog();

    await user.click(screen.getByRole("button", { name: "Move Grey Wolves to Winners" }));
    expect(column("Winners")).toEqual(["Iron Vultures", "Grey Wolves"]);
    await user.click(screen.getByRole("button", { name: "Move Iron Vultures to Losers" }));
    await user.click(screen.getByRole("button", { name: "Confirm results" }));

    expect(onSubmit).toHaveBeenCalledWith({ winners: [103], losers: [101, 102] });
  });

  it("moves a card dragged onto the other column", () => {
    renderDialog();
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      get types() {
        return [...data.keys()];
      },
      effectAllowed: "",
    };
    const card = screen.getByText("Night Razors").closest("li") as HTMLElement;
    fireEvent.dragStart(card, { dataTransfer });
    const winners = screen.getByRole("region", { name: "Winners" });
    const over = createEvent.dragOver(winners, { dataTransfer });
    fireEvent(winners, over);
    expect(over.defaultPrevented).toBe(true);
    fireEvent.drop(winners, { dataTransfer });

    expect(column("Winners")).toEqual(["Iron Vultures", "Night Razors"]);
  });

  it("sends No winner as empty sides: nobody wins or loses", async () => {
    const user = userEvent.setup();
    const onSubmit = renderDialog();

    await user.click(screen.getByRole("button", { name: "No winner" }));
    expect(column("Winners")).toEqual([]);
    expect(screen.getByText("No winner: no wins or losses are recorded.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm results" }));

    expect(onSubmit).toHaveBeenCalledWith({ winners: [], losers: [] });
  });
});
