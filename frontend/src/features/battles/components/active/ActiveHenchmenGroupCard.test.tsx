import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";

import ActiveHenchmenGroupCard from "./ActiveHenchmenGroupCard";

function createMember(key: string, name: string): PrebattleUnit {
  return {
    key,
    id: Number(key.split(":")[1]),
    kind: "henchman",
    displayName: name,
    unitType: "Youngblood",
    stats: {
      movement: 4,
      weapon_skill: 2,
      ballistic_skill: 2,
      strength: 3,
      toughness: 3,
      wounds: 1,
      initiative: 3,
      attacks: 1,
      leadership: 6,
      armour_save: null,
    },
  };
}

describe("ActiveHenchmenGroupCard", () => {
  it("applies wounds changes and targeted member stat edits", async () => {
    const user = userEvent.setup();
    const onAdjustWounds = vi.fn().mockResolvedValue(undefined);
    const onSaveOverride = vi.fn().mockResolvedValue(undefined);

    render(
      <ActiveHenchmenGroupCard
        groupName="Youngbloods"
        groupType="Youngblood"
        members={[createMember("henchman:1", "Lad One"), createMember("henchman:2", "Lad Two")]}
        canInteract
        unitInformationByKey={{
          "henchman:2": {
            stats_override: { wounds: 2 },
            stats_reason: "Lucky break",
            out_of_action: false,
            kill_count: 0,
          },
        }}
        killTargetOptions={[]}
        onSetOutOfAction={vi.fn().mockResolvedValue(undefined)}
        onAdjustWounds={onAdjustWounds}
        onSaveOverride={onSaveOverride}
        onRecordKill={vi.fn().mockResolvedValue(undefined)}
        onUseSingleUseItem={vi.fn().mockResolvedValue(undefined)}
        getUsedSingleUseItemCount={() => 0}
        activeItemActionKey={null}
      />
    );

    await user.click(screen.getByLabelText("Increase wounds for Lad One"));
    expect(onAdjustWounds).toHaveBeenCalledWith(expect.objectContaining({ key: "henchman:1" }), 1);

    await user.click(screen.getByLabelText("Expand henchmen group details"));
    await user.selectOptions(screen.getByLabelText("Member"), "henchman:2");
    await waitFor(() => expect(screen.getByLabelText("Edit stats")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Edit stats"));

    const woundsInput = screen.getAllByRole("spinbutton")[5];
    fireEvent.change(woundsInput, { target: { value: "3" } });
    const reasonInput = screen.getByPlaceholderText("Reason for temporary change");
    fireEvent.change(reasonInput, { target: { value: "Shielded" } });
    await user.click(screen.getByLabelText("Apply stat changes"));

    await waitFor(() =>
      expect(onSaveOverride).toHaveBeenCalledWith("henchman:2", {
        reason: "Shielded",
        stats: { wounds: 3 },
      })
    );
  });
});
