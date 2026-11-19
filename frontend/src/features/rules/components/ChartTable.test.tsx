/**
 * A result the book hangs its own table off shows that table under it (William, 20 Nov 2026):
 * Border Town Burning's Curious bloom sits under result 31 of Perilous phenomenon, rather than
 * being a chart of its own that the player has to go and find.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ChartTable from "./ChartTable";
import type { CampaignChartRow } from "../types/rule-types";

const rows: CampaignChartRow[] = [
  { id: 1, result: "31", name: "Curious Bloom", text: "A hero smells the bloom.", chart: null },
  { id: 2, result: "33", name: "Old Well", text: "He falls in." },
];

const withTable: CampaignChartRow[] = [
  {
    ...rows[0],
    chart: {
      dice: "D6",
      description: "Roll for what the bloom does.",
      note: "A hero already blooming rolls again.",
      rows: [
        { result: "1-3", name: "Nothing", text: "The bloom is spent." },
        { result: "4-6", name: "Pollen", text: "He is blinded." },
      ],
    },
  },
  rows[1],
];

describe("A chart's results", () => {
  it("show a result's own table under it, with its own results", () => {
    render(<ChartTable rows={withTable} dice="D66" />);

    expect(screen.getByText("Roll for what the bloom does.")).toBeInTheDocument();
    expect(screen.getByText("The bloom is spent.")).toBeInTheDocument();
    expect(screen.getByText("A hero already blooming rolls again.")).toBeInTheDocument();
    // the nested table is its own, with the die it is rolled on
    expect(screen.getByRole("columnheader", { name: "D66" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "D6" })).toBeInTheDocument();
  });

  it("shows nothing extra for a result that has no table", () => {
    render(<ChartTable rows={rows} dice="D66" />);

    expect(screen.queryByText("Roll for what the bloom does.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Curious Bloom")).toBeInTheDocument();
  });
});
