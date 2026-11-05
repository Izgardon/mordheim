import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { WarbandTrade, WarbandTradeChild } from "../../types/warband-types";
import TreasuryTab from "./TreasuryTab";

const AT = "2026-11-05T10:00:00Z";
const child = (id: number, action: string, description: string, price: number) =>
  ({ id, action, description, price, notes: "", created_at: AT }) satisfies WarbandTradeChild;
const row = (fields: Partial<WarbandTrade> & Pick<WarbandTrade, "id">): WarbandTrade => ({
  warband_id: 9,
  parent_id: null,
  action: "Buy",
  description: "",
  price: 0,
  notes: "",
  children: [],
  created_at: AT,
  updated_at: AT,
  ...fields,
});

function renderLedger(rows: WarbandTrade[]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.campaign.warbandTreasury(7, 9), {
    pages: [{ results: rows, next_cursor: null }],
    pageParams: [null],
  });
  return renderWithQueryClient(<TreasuryTab campaignId={7} warbandId={9} canEdit={false} />, {
    queryClient,
  });
}

describe("TreasuryTab", () => {
  it("shows a Group row's total and opens it to its rows", async () => {
    const user = setupUser();
    renderLedger([
      row({
        id: 104,
        action: "Group",
        description: "Recruited 3 Review Marauders",
        children: [
          child(105, "Recruit", "Chaos Marauder 1", -35),
          child(106, "Recruit", "Chaos Marauder 2", -35),
          child(107, "Recruit", "Chaos Marauder 3", -35),
        ],
      }),
      row({ id: 101, action: "Starting gold", description: "Raised", price: 500 }),
    ]);

    const group = screen.getByRole("button", { name: "Recruited 3 Review Marauders" });
    expect(group.closest("li")).toHaveTextContent("-105 gc");
    expect(screen.queryByText("Chaos Marauder 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raised" })).not.toBeInTheDocument();

    await user.click(group);
    expect(group).toHaveAttribute("aria-expanded", "true");
    const rows = within(
      screen.getByRole("list", { name: "Recruited 3 Review Marauders: its rows" })
    );
    expect(rows.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "RecruitChaos Marauder 1-35 gc",
      "RecruitChaos Marauder 2-35 gc",
      "RecruitChaos Marauder 3-35 gc",
    ]);

    await user.click(group);
    expect(screen.queryByText("Chaos Marauder 1")).not.toBeInTheDocument();
  });
});
