import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  addWarbandItem: vi.fn(),
  createWarbandLog: vi.fn(),
  createWarbandTrade: vi.fn(),
  getWarbandHenchmenGroupDetail: vi.fn(),
  getWarbandHeroDetail: vi.fn(),
  getWarbandHiredSwordDetail: vi.fn(),
  listWarbandHenchmenGroups: vi.fn(),
  listWarbandHeroes: vi.fn(),
  listWarbandTrades: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
  updateWarbandHiredSword: vi.fn(),
  updateWarbandHero: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
}));

let mockWarband: any = null;

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: mockWarband }),
}));

vi.mock("@/features/warbands/api/warbands-api", () => apiMocks);
vi.mock("@/features/warbands/api/warbands-events", () => eventMocks);

import { useAcquireItemDialogShared } from "../useAcquireItemDialogShared";

const rareItem = {
  id: 55,
  name: "Lucky Charm",
  type: "Misc",
  description: "",
  availabilities: [{ id: 1, cost: 20, rarity: 9, restrictions: [] }],
} as const;

function TestHarness() {
  const state = useAcquireItemDialogShared({
    item: rareItem as any,
    open: true,
    onOpenChange: vi.fn(),
    presetUnitType: "heroes",
    presetUnitId: 99,
    disableUnitSelection: true,
    emitWarbandUpdate: true,
    deferCommit: false,
    reservedGold: 0,
  });

  return (
    <div>
      <div data-testid="action-disabled">{String(state.actionDisabled)}</div>
      <div data-testid="action-disabled-reason">{state.actionDisabledReason || "-"}</div>
      <div data-testid="roll-disabled">{String(state.rollDisabled)}</div>
      <div data-testid="rarity-roll-summary">{state.raritySummary.rollSummary || "-"}</div>
      <div data-testid="rarity-success">
        {state.raritySummary.success === null ? "null" : String(state.raritySummary.success)}
      </div>
      <div data-testid="hero-options">
        {state.heroOptions
          .map((hero) => `${hero.name}:${hero.trading_action === false ? "spent" : "open"}`)
          .join("|")}
      </div>
      <button onClick={() => state.handleSearchingHeroChange("1")}>Select Hero One</button>
      <button onClick={() => state.handleSearchingHeroChange("2")}>Select Hero Two</button>
      <button onClick={() => state.handleRarityRollTotalChange(4)}>Roll Four</button>
    </div>
  );
}

describe("useAcquireItemDialogShared", () => {
  beforeEach(() => {
    mockWarband = {
      id: 7,
      heroes: [
        { id: 1, name: "Hero One", trading_action: true },
        { id: 2, name: "Hero Two", trading_action: true },
      ],
      hired_swords: [],
      resources: [{ name: "Gold Crowns", amount: 100 }],
    };

    apiMocks.addWarbandItem.mockReset();
    apiMocks.createWarbandLog.mockReset();
    apiMocks.createWarbandTrade.mockReset();
    apiMocks.getWarbandHenchmenGroupDetail.mockReset();
    apiMocks.getWarbandHeroDetail.mockReset();
    apiMocks.getWarbandHiredSwordDetail.mockReset();
    apiMocks.listWarbandHenchmenGroups.mockReset();
    apiMocks.listWarbandHeroes.mockReset();
    apiMocks.listWarbandTrades.mockReset();
    apiMocks.updateWarbandHenchmenGroup.mockReset();
    apiMocks.updateWarbandHiredSword.mockReset();
    apiMocks.updateWarbandHero.mockReset();
    eventMocks.emitWarbandUpdate.mockReset();

    apiMocks.listWarbandHeroes.mockResolvedValue(mockWarband.heroes);
    apiMocks.listWarbandHenchmenGroups.mockResolvedValue([]);
    apiMocks.updateWarbandHero.mockResolvedValue({});
    apiMocks.createWarbandLog.mockResolvedValue({});
  });

  it("allows buying without a rarity roll and preserves local rarity state after a failed roll", async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    await waitFor(() =>
      expect(screen.getByTestId("action-disabled")).toHaveTextContent("false")
    );
    expect(screen.getByTestId("action-disabled-reason")).toHaveTextContent("-");
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "Select Hero One" }));
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("false");
    await user.click(screen.getByRole("button", { name: "Roll Four" }));

    await waitFor(() => expect(apiMocks.updateWarbandHero).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiMocks.createWarbandLog).toHaveBeenCalledTimes(1));

    expect(apiMocks.updateWarbandHero).toHaveBeenCalledWith(7, 1, { trading_action: false });
    expect(apiMocks.createWarbandLog).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        feature: "trading_action",
        entry_type: "rarity roll",
        payload: expect.objectContaining({
          hero: "Hero One",
          item: "Lucky Charm",
          roll: 4,
          modifier: 0,
          success: false,
        }),
      }),
      { emitUpdate: false }
    );
    expect(eventMocks.emitWarbandUpdate).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByTestId("hero-options")).toHaveTextContent("Hero One:spent|Hero Two:open")
    );
    expect(screen.getByTestId("action-disabled")).toHaveTextContent("false");
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("true");
    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-> 4 + 0 = 4");
    expect(screen.getByTestId("rarity-success")).toHaveTextContent("false");

    await user.click(screen.getByRole("button", { name: "Roll Four" }));
    expect(apiMocks.updateWarbandHero).toHaveBeenCalledTimes(1);
    expect(apiMocks.createWarbandLog).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Select Hero Two" }));
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("false");
    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-");
    expect(screen.getByTestId("rarity-success")).toHaveTextContent("null");

    await user.click(screen.getByRole("button", { name: "Select Hero One" }));
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("true");
    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-> 4 + 0 = 4");
    expect(screen.getByTestId("rarity-success")).toHaveTextContent("false");
  });
});
