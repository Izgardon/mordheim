/**
 * At 1440 px the overview's standings scrolled sideways beside the 380 px aside (found in the
 * fluff-and-banner browser check): the table no longer holds a 720 px minimum, and the type sits
 * under the warband's name until the screen is wide enough for its own column. Campaign points are
 * a column of their own, and a line under the rating on a phone, only while the campaign has them
 * on (William, 20 Nov 2026: "campaign points beside rating in the standings table").
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import StandingsTable from "./StandingsTable";

const rows = [
  {
    rank: 1,
    playerId: 3,
    player: "Raider 3",
    warbandId: 8,
    warband: "The Very Long Named Company of the Ashen Crows",
    warbandType: "Reiklanders",
    rating: 152,
    campaignPoints: 12,
    record: "3–1–0",
  },
];

describe("StandingsTable", () => {
  it("fits its column: no fixed minimum width, and the type under the name", () => {
    render(
      <MemoryRouter>
        <StandingsTable rows={rows} campaignId={1} userId={1} isMobile={false} />
      </MemoryRouter>
    );
    const table = screen.getByRole("table");
    expect(table.className).not.toMatch(/min-w-/);
    const [, warband, , type] = within(table).getAllByRole("cell");
    expect(within(warband).getByText("Reiklanders")).toBeInTheDocument();
    expect(type.className).toMatch(/hidden min-\[1600px\]:table-cell/);
    expect(warband.className).toMatch(/break-words/);
  });

  it("shows campaign points beside the rating, on the web and on a phone, only when they are on", () => {
    const { unmount } = render(
      <MemoryRouter>
        <StandingsTable rows={rows} campaignId={1} userId={1} isMobile={false} showCampaignPoints />
      </MemoryRouter>
    );
    expect(screen.getByTitle("Campaign points")).toHaveTextContent("CP");
    expect(screen.getByRole("cell", { name: "12" })).toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <StandingsTable rows={rows} campaignId={1} userId={1} isMobile showCampaignPoints />
      </MemoryRouter>
    );
    expect(screen.getByText("12 CP")).toBeInTheDocument();
  });

  it("leaves them out with campaign points off", () => {
    render(
      <MemoryRouter>
        <StandingsTable rows={rows} campaignId={1} userId={1} isMobile={false} />
      </MemoryRouter>
    );

    expect(screen.queryByTitle("Campaign points")).toBeNull();
    expect(screen.queryByRole("cell", { name: "12" })).toBeNull();
  });
});
