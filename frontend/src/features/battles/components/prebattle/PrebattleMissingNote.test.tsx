import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PrebattleHenchmenGroupRow from "./PrebattleHenchmenGroupRow";
import PrebattleUnitRow, { type PrebattleRowTools } from "./PrebattleUnitRow";
import { DEFAULT_STATS, type PrebattleUnit } from "./prebattle-types";

const wounded: PrebattleUnit = {
  key: "hero:3",
  id: 3,
  kind: "hero",
  displayName: "Rolf",
  unitType: "Champion",
  stats: DEFAULT_STATS,
  missingGames: 2,
  missingReason: "Deep wound",
};

const tools = (selected: string[]): PrebattleRowTools => ({
  editable: true,
  isUnitSelected: (unitKey) => selected.includes(unitKey),
  getUnitOverride: () => undefined,
  getUnitNotes: () => "",
  editingUnitKey: null,
  onToggleUnitSelection: vi.fn(),
  onToggleEditingUnit: vi.fn(),
  onUpdateOverrideStat: vi.fn(),
  onUpdateUnitNotes: vi.fn(),
  onClearUnitOverride: vi.fn(),
  onRemoveCustomUnit: vi.fn(),
  canUseItems: false,
  onUseSingleUseItem: vi.fn(),
  getUsedSingleUseItemCount: () => 0,
  activeItemActionKey: null,
});

const BROUGHT = "Brought anyway: it should miss this battle, which still counts one game off.";

describe("missing units in prebattle", () => {
  it("says how many more games a unit misses and why, and warns only once it is picked", () => {
    const { rerender } = render(<PrebattleUnitRow unit={wounded} tools={tools([])} />);

    expect(screen.getByText("Missing (2 more games): Deep wound")).toBeInTheDocument();
    expect(screen.queryByText(BROUGHT)).not.toBeInTheDocument();

    rerender(<PrebattleUnitRow unit={wounded} tools={tools(["hero:3"])} />);
    expect(screen.getByRole("status")).toHaveTextContent(BROUGHT);
  });

  it("says nothing for a unit that fights", () => {
    render(<PrebattleUnitRow unit={{ ...wounded, missingGames: 0 }} tools={tools(["hero:3"])} />);

    expect(screen.queryByText(/^Missing/)).not.toBeInTheDocument();
  });

  it("marks a missing henchmen group, and warns when any member is picked", () => {
    const member = { ...wounded, key: "henchman:8", id: 8, kind: "henchman" as const };
    const group = {
      id: 11,
      name: "Youngbloods",
      unitType: "Youngblood",
      missingGames: 1,
      missingReason: "",
      members: [{ ...member, missingGames: 1, missingReason: "" }],
    };

    render(<PrebattleHenchmenGroupRow group={group} {...tools(["henchman:8"])} />);

    expect(screen.getByText("Missing (1 more game)")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(BROUGHT);
  });
});
