import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

vi.mock("../ActiveUnitExpandedDetails", () => ({
  default: ({
    unit,
    canInteract,
    onSaveNotes,
  }: {
    unit: { displayName: string };
    canInteract: boolean;
    onSaveNotes?: (notes: string) => Promise<void> | void;
  }) => (
    <textarea
      aria-label={`Notes for ${unit.displayName}`}
      readOnly={!canInteract}
      onChange={(event) => {
        void onSaveNotes?.(event.currentTarget.value);
      }}
    />
  ),
}));

vi.mock("../ActiveKillDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/warbands/components/shared/unit_details/UnitStatsTable", () => ({
  default: () => <div>Stats</div>,
}));

import ActiveUnitCard from "../ActiveUnitCard";

function createUnit(overrides: Partial<PrebattleUnit> = {}): PrebattleUnit {
  return {
    key: "hero:1",
    id: 1,
    kind: "hero",
    displayName: "Captain Wolf",
    unitType: "Captain",
    stats: {
      movement: 4,
      weapon_skill: 4,
      ballistic_skill: 4,
      strength: 4,
      toughness: 3,
      wounds: 2,
      initiative: 4,
      attacks: 1,
      leadership: 8,
      armour_save: null,
    },
    ...overrides,
  };
}

describe("ActiveUnitCard", () => {
  it("shows current_wounds and routes note saves through the expanded details callback", async () => {
    const onAdjustWounds = vi.fn().mockResolvedValue(undefined);
    const onSaveUnitNotes = vi.fn().mockResolvedValue(undefined);

    render(
      <ActiveUnitCard
        unit={createUnit()}
        unitInformation={{
          stats_override: { wounds: 1 },
          current_wounds: 3,
          notes: "",
          out_of_action: false,
          kill_count: 0,
        }}
        canInteract
        killTargetOptions={[]}
        onSetOutOfAction={vi.fn().mockResolvedValue(undefined)}
        onAdjustWounds={onAdjustWounds}
        onSaveOverride={vi.fn().mockResolvedValue(undefined)}
        onSaveUnitNotes={onSaveUnitNotes}
        onRecordKill={vi.fn().mockResolvedValue(undefined)}
        onUseSingleUseItem={vi.fn().mockResolvedValue(undefined)}
        getUsedSingleUseItemCount={() => 0}
        activeItemActionKey={null}
      />
    );

    expect(screen.getAllByText("3")[0]).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText("Increase wounds")[0]);
    expect(onAdjustWounds).toHaveBeenCalledWith(expect.objectContaining({ key: "hero:1" }), 1);

    fireEvent.click(screen.getByLabelText("Expand unit details"));
    fireEvent.change(screen.getByLabelText("Notes for Captain Wolf"), {
      target: { value: "Battle plan" },
    });

    expect(onSaveUnitNotes).toHaveBeenCalledWith("hero:1", "Battle plan");
  });

  it("keeps wounds and stat editing read-only when interaction is disabled", async () => {
    render(
      <ActiveUnitCard
        unit={createUnit()}
        unitInformation={{
          stats_override: {},
          out_of_action: false,
          kill_count: 0,
        }}
        canInteract={false}
        killTargetOptions={[]}
        onSetOutOfAction={vi.fn().mockResolvedValue(undefined)}
        onAdjustWounds={vi.fn().mockResolvedValue(undefined)}
        onSaveOverride={vi.fn().mockResolvedValue(undefined)}
        onSaveUnitNotes={vi.fn().mockResolvedValue(undefined)}
        onRecordKill={vi.fn().mockResolvedValue(undefined)}
        onUseSingleUseItem={vi.fn().mockResolvedValue(undefined)}
        getUsedSingleUseItemCount={() => 0}
        activeItemActionKey={null}
      />
    );

    for (const button of screen.getAllByLabelText("Increase wounds")) {
      expect(button).toBeDisabled();
    }

    fireEvent.click(screen.getByLabelText("Expand unit details"));
    expect(await screen.findByLabelText("Notes for Captain Wolf")).toHaveAttribute("readonly");
  });
});
