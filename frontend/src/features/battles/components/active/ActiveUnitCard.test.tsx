import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

import ActiveUnitCard from "./ActiveUnitCard";

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
  it("supports inline wounds changes and debounced notes saving in expanded details", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onAdjustWounds = vi.fn().mockResolvedValue(undefined);
    const onSaveUnitNotes = vi.fn().mockResolvedValue(undefined);

    try {
      render(
        <ActiveUnitCard
          unit={createUnit()}
          unitInformation={{
            stats_override: { wounds: 1 },
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

      await user.click(screen.getAllByLabelText("Increase wounds")[0]);
      expect(onAdjustWounds).toHaveBeenCalledWith(expect.objectContaining({ key: "hero:1" }), 1);

      await user.click(screen.getByLabelText("Expand unit details"));
      const notesInput = await screen.findByLabelText("Notes for Captain Wolf");
      await user.type(notesInput, "Battle plan");

      vi.advanceTimersByTime(1000);

      await waitFor(() => expect(onSaveUnitNotes).toHaveBeenCalledWith("hero:1", "Battle plan"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps wounds and stat editing read-only when interaction is disabled", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByLabelText("Expand unit details"));
    expect(await screen.findByLabelText("Notes for Captain Wolf")).toHaveAttribute("readonly");
  });
});
