import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BattleShell from "./BattleShell";

const mocks = vi.hoisted(() => ({
  useMediaQuery: vi.fn(),
  useOutletContext: vi.fn(),
  latestOutletContext: null as Record<string, unknown> | null,
  outletMounts: vi.fn(),
}));

function MockOutlet({ context }: { context?: Record<string, unknown> }) {
  mocks.latestOutletContext = context ?? null;
  useEffect(() => {
    mocks.outletMounts();
  }, []);
  return <div data-testid="battle-layout-outlet" />;
}

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Outlet: MockOutlet,
    useOutletContext: () => mocks.useOutletContext(),
  };
});

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: mocks.useMediaQuery,
}));

vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({
  default: () => <div data-testid="campaign-dice-menu" />,
}));

describe("BattleShell (the battle layout's chrome)", () => {
  beforeEach(() => {
    mocks.latestOutletContext = null;
    mocks.useMediaQuery.mockReturnValue(true);
    mocks.useOutletContext.mockReturnValue({});
  });

  it("renders the unit type selector when only section options are provided", () => {
    render(<BattleShell />);

    expect(mocks.latestOutletContext).toBeTruthy();

    act(() => {
      (
        mocks.latestOutletContext as { setBattleMobileTopBar?: (config: unknown) => void }
      ).setBattleMobileTopBar?.({
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

  it("keeps the battle page mounted when the viewport crosses 960 px (BUG-23)", () => {
    mocks.outletMounts.mockClear();
    const { rerender } = render(<BattleShell />);

    mocks.useMediaQuery.mockReturnValue(false);
    rerender(<BattleShell />);
    mocks.useMediaQuery.mockReturnValue(true);
    rerender(<BattleShell />);

    expect(screen.getByTestId("battle-layout-outlet")).toBeInTheDocument();
    expect(mocks.outletMounts).toHaveBeenCalledTimes(1);
  });
});
