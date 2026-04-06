import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import RosterTable from "./RosterTable";

vi.mock("./UnitsTable", () => ({
  default: () => <div>Units table</div>,
}));

describe("RosterTable", () => {
  it("uses a fixed mobile table layout so the warband column can keep shrinking", () => {
    render(
      <MemoryRouter>
        <RosterTable
          campaignId={7}
          playerCount={1}
          maxPlayers={6}
          isMobile={true}
          mobileExpanded={true}
          onToggleMobileExpanded={() => undefined}
          isLoading={false}
          error=""
          players={[
            {
              id: 13,
              name: "Very Long Player Name",
              warband: {
                id: 44,
                name: "Ridiculously Long Warband Name That Should Truncate",
                faction: "Sisters",
                wins: 1,
                losses: 0,
              },
            },
          ]}
          expandedPlayers={[]}
          onTogglePlayer={() => undefined}
          heroSnapshots={{ 44: [] }}
          snapshotLoading={{ 44: false }}
          snapshotErrors={{ 44: "" }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("table")).toHaveClass("table-fixed");
    expect(screen.getByText("Ridiculously Long Warband Name That Should Truncate")).toHaveClass(
      "truncate",
      "min-w-0"
    );
  });

  it("shows a warband record strip above expanded units and derives battles from wins and losses", () => {
    render(
      <MemoryRouter>
        <RosterTable
          campaignId={7}
          playerCount={1}
          maxPlayers={6}
          isMobile={false}
          mobileExpanded={true}
          onToggleMobileExpanded={() => undefined}
          isLoading={false}
          error=""
          players={[
            {
              id: 11,
              name: "Klara",
              warband: {
                id: 42,
                name: "Black Fangs",
                faction: "Skaven",
                wins: 3,
                losses: 2,
              },
            },
          ]}
          expandedPlayers={[11]}
          onTogglePlayer={() => undefined}
          heroSnapshots={{ 42: [] }}
          snapshotLoading={{ 42: false }}
          snapshotErrors={{ 42: "" }}
        />
      </MemoryRouter>
    );

    const record = screen.getByRole("list", { name: "Warband record" });

    expect(within(record).getByLabelText("Battles: 5")).toBeInTheDocument();
    expect(within(record).getByLabelText("Wins: 3")).toBeInTheDocument();
    expect(within(record).getByLabelText("Losses: 2")).toBeInTheDocument();
    expect(screen.getByText("No units logged yet.")).toBeInTheDocument();
  });

  it("falls back to zero for missing warband record values", () => {
    render(
      <MemoryRouter>
        <RosterTable
          campaignId={7}
          playerCount={1}
          maxPlayers={6}
          isMobile={false}
          mobileExpanded={true}
          onToggleMobileExpanded={() => undefined}
          isLoading={false}
          error=""
          players={[
            {
              id: 12,
              name: "Marta",
              warband: {
                id: 43,
                name: "Ash Hounds",
                faction: "Mercenaries",
                wins: null,
                losses: null,
              },
            },
          ]}
          expandedPlayers={[12]}
          onTogglePlayer={() => undefined}
          heroSnapshots={{ 43: [] }}
          snapshotLoading={{ 43: false }}
          snapshotErrors={{ 43: "" }}
        />
      </MemoryRouter>
    );

    const record = screen.getByRole("list", { name: "Warband record" });

    expect(within(record).getByLabelText("Battles: 0")).toBeInTheDocument();
    expect(within(record).getByLabelText("Wins: 0")).toBeInTheDocument();
    expect(within(record).getByLabelText("Losses: 0")).toBeInTheDocument();
  });
});
