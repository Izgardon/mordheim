import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { createQueryWrapper } from "@/test/query-test-utils";

const apiMocks = vi.hoisted(() => ({
  addWarbandItem: vi.fn(),
  createWarbandLog: vi.fn(),
  createWarbandTrade: vi.fn(),
  getWarbandHenchmenGroupDetail: vi.fn(),
  getWarbandHeroDetail: vi.fn(),
  getWarbandHirelingDetail: vi.fn(),
  listWarbandHenchmenGroups: vi.fn(),
  listWarbandHeroes: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
  updateWarbandHireling: vi.fn(),
  updateWarbandHero: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  emitWarbandUpdate: vi.fn(),
}));

type MockWarband = {
  id: number;
  heroes: { id: number; name: string; trading_action: boolean }[];
  hirelings: unknown[];
  gold: number;
};

let mockWarband: MockWarband | null = null;

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: mockWarband }),
}));

vi.mock("@/features/warbands/api/warbands-api", () => apiMocks);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
  useWarbandCacheUpdate: () => eventMocks.emitWarbandUpdate,
}));

import { useAcquireItemDialogShared } from "./useAcquireItemDialogShared";

import type { Item } from "../types/item-types";

const rareItem: Item = {
  id: 55,
  name: "Lucky Charm",
  type: "Misc",
  description: "",
  availabilities: [{ id: 1, cost: 20, rarity: 9, restrictions: [] }],
};

function TestHarness() {
  const state = useAcquireItemDialogShared({
    item: rareItem,
    open: true,
    onOpenChange: vi.fn(),
    presetUnitType: "heroes",
    presetUnitId: 99,
    disableUnitSelection: true,
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
      hirelings: [],
      gold: 100,
    };

    apiMocks.addWarbandItem.mockReset();
    apiMocks.createWarbandLog.mockReset();
    apiMocks.createWarbandTrade.mockReset();
    apiMocks.getWarbandHenchmenGroupDetail.mockReset();
    apiMocks.getWarbandHeroDetail.mockReset();
    apiMocks.getWarbandHirelingDetail.mockReset();
    apiMocks.listWarbandHenchmenGroups.mockReset();
    apiMocks.listWarbandHeroes.mockReset();
    apiMocks.updateWarbandHenchmenGroup.mockReset();
    apiMocks.updateWarbandHireling.mockReset();
    apiMocks.updateWarbandHero.mockReset();
    eventMocks.emitWarbandUpdate.mockReset();

    apiMocks.listWarbandHeroes.mockResolvedValue(mockWarband.heroes);
    apiMocks.listWarbandHenchmenGroups.mockResolvedValue([]);
    apiMocks.updateWarbandHero.mockResolvedValue({});
    apiMocks.createWarbandLog.mockResolvedValue({});
  });

  it("allows buying without a rarity roll and preserves local rarity state after a failed roll", async () => {
    const user = userEvent.setup();

    render(<TestHarness />, { wrapper: createQueryWrapper() });

    await waitFor(() => expect(screen.getByTestId("action-disabled")).toHaveTextContent("false"));
    expect(screen.getByTestId("action-disabled-reason")).toHaveTextContent("-");
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "Select Hero One" }));
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("false");
    await user.click(screen.getByRole("button", { name: "Roll Four" }));

    // The roll is kept for the purchase (or saved when the dialog closes): the browser no longer
    // spends the hero or logs the search itself (decision 9, ECON-CQ-02).
    expect(apiMocks.updateWarbandHero).not.toHaveBeenCalled();
    expect(apiMocks.createWarbandLog).not.toHaveBeenCalled();
    expect(eventMocks.emitWarbandUpdate).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByTestId("hero-options")).toHaveTextContent("Hero One:spent|Hero Two:open")
    );
    expect(screen.getByTestId("action-disabled")).toHaveTextContent("false");
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("true");
    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-> 4 + 0 = 4");
    expect(screen.getByTestId("rarity-success")).toHaveTextContent("false");

    // One roll per hero.
    await user.click(screen.getByRole("button", { name: "Roll Four" }));
    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-> 4 + 0 = 4");

    await user.click(screen.getByRole("button", { name: "Select Hero Two" }));
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("false");
    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-");
    expect(screen.getByTestId("rarity-success")).toHaveTextContent("null");

    await user.click(screen.getByRole("button", { name: "Select Hero One" }));
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("true");
    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-> 4 + 0 = 4");
    expect(screen.getByTestId("rarity-success")).toHaveTextContent("false");
  });

  it("lets a hero who already used his trading action search, once (decision 9, ECON-TWEAK-01)", async () => {
    const user = userEvent.setup();
    mockWarband = { ...mockWarband!, heroes: [{ id: 1, name: "Hero One", trading_action: false }] };
    apiMocks.listWarbandHeroes.mockResolvedValue(mockWarband.heroes);

    render(<TestHarness />, { wrapper: createQueryWrapper() });
    await waitFor(() =>
      expect(screen.getByTestId("hero-options")).toHaveTextContent("Hero One:spent")
    );

    await user.click(screen.getByRole("button", { name: "Select Hero One" }));
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("false");
    await user.click(screen.getByRole("button", { name: "Roll Four" }));

    expect(screen.getByTestId("rarity-roll-summary")).toHaveTextContent("-> 4 + 0 = 4");
    expect(screen.getByTestId("roll-disabled")).toHaveTextContent("true");
  });
});
