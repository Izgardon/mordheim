import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BattleLayout from "../BattleLayout";

const mocks = vi.hoisted(() => ({
  useMediaQuery: vi.fn(),
  useOutletContext: vi.fn(),
  latestOutletContext: null as Record<string, unknown> | null,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Outlet: ({ context }: { context?: Record<string, unknown> }) => {
      mocks.latestOutletContext = context ?? null;
      return <div data-testid="battle-layout-outlet" />;
    },
    useOutletContext: () => mocks.useOutletContext(),
  };
});

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: mocks.useMediaQuery,
}));

vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({
  default: () => <div data-testid="campaign-dice-menu" />,
}));

describe("BattleLayout", () => {
  beforeEach(() => {
    mocks.latestOutletContext = null;
    mocks.useMediaQuery.mockReturnValue(true);
    mocks.useOutletContext.mockReturnValue({});
  });

  it("renders the unit type selector when only section options are provided", () => {
    render(<BattleLayout />);

    expect(mocks.latestOutletContext).toBeTruthy();

    act(() => {
      (mocks.latestOutletContext as { setBattleMobileTopBar?: (config: unknown) => void })
        .setBattleMobileTopBar?.({
          title: "Postbattle",
          onBack: vi.fn(),
          unitTypeOptions: [
            { value: "exploration", label: "Exploration" },
            { value: "roster", label: "Roster" },
          ],
          selectedUnitTypeValue: "exploration",
          onUnitTypeChange: vi.fn(),
        });
    });

    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(1);
    expect(selects[0]).toHaveValue("exploration");
    expect(screen.getByRole("option", { name: "Exploration" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Roster" })).toBeInTheDocument();
  });
});
