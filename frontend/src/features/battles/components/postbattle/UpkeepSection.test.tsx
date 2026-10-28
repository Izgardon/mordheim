import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UpkeepSection from "./UpkeepSection";

import type { UpkeepRow } from "./postbattle-summary";

const row = (overrides: Partial<UpkeepRow>): UpkeepRow => ({
  unitKey: "hireling:4",
  unitName: "Grukk",
  unitType: "Ogre Bodyguard",
  cost: 30,
  costExpression: null,
  hasFixedCost: true,
  dead: false,
  ...overrides,
});

const renderRows = (rows: UpkeepRow[]) =>
  render(
    <UpkeepSection
      isMobile={false}
      rows={rows}
      total={30}
      payUpkeep
      isFinalized={false}
      onCommitCost={vi.fn()}
      onTogglePayUpkeep={vi.fn()}
    />
  );

describe("UpkeepSection", () => {
  it("shows an upkeep formula beside the gold as a reminder", () => {
    renderRows([row({ unitName: "Skink", cost: 0, costExpression: "1 piece of wyrdstone" })]);

    expect(screen.getByText("Upkeep: 1 piece of wyrdstone")).toBeVisible();
  });

  it("shows no reminder for upkeep in gold alone", () => {
    renderRows([row({})]);

    expect(screen.queryByText(/^Upkeep: /)).toBeNull();
  });
});
