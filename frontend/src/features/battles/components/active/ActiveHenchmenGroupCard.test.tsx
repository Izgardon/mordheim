import { render, screen, within } from "@testing-library/react";
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
  it("tracks each henchman's current wounds without changing the shared stats table", async () => {
    const user = userEvent.setup();
    const onAdjustWounds = vi.fn().mockResolvedValue(undefined);

    render(
      <ActiveHenchmenGroupCard
        groupName="Youngbloods"
        groupType="Youngblood"
        members={[createMember("henchman:1", "Lad One"), createMember("henchman:2", "Lad Two")]}
        canInteract
        unitInformationByKey={{
          "henchman:2": {
            stats_override: {},
            notes: "Lucky break",
            current_wounds: 2,
            out_of_action: false,
            kill_count: 0,
          },
        }}
        killTargetOptions={[]}
        onSetOutOfAction={vi.fn().mockResolvedValue(undefined)}
        onAdjustWounds={onAdjustWounds}
        onSaveOverride={vi.fn().mockResolvedValue(undefined)}
        onSaveUnitNotes={vi.fn().mockResolvedValue(undefined)}
        onRecordKill={vi.fn().mockResolvedValue(undefined)}
        onUseSingleUseItem={vi.fn().mockResolvedValue(undefined)}
        getUsedSingleUseItemCount={() => 0}
        activeItemActionKey={null}
      />
    );

    await user.click(screen.getByLabelText("Increase wounds for Lad One"));
    expect(onAdjustWounds).toHaveBeenCalledWith(expect.objectContaining({ key: "henchman:1" }), 1);
    expect(screen.getAllByRole("cell")[5]).toHaveTextContent("1");

    const ladTwoTile = screen.getByText("Lad Two").closest(".battle-metric-box");
    expect(ladTwoTile).not.toBeNull();
    expect(within(ladTwoTile as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("shows loadout details without a member selector when expanded", async () => {
    const user = userEvent.setup();

    render(
      <ActiveHenchmenGroupCard
        groupName="Youngbloods"
        groupType="Youngblood"
        members={[
          {
            ...createMember("henchman:1", "Lad One"),
            items: [{ id: 11, name: "Club", count: 1, singleUse: false }],
          },
          createMember("henchman:2", "Lad Two"),
        ]}
        canInteract
        unitInformationByKey={{}}
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

    await user.click(screen.getByLabelText("Details for Youngbloods"));

    expect(screen.queryByText("Member")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Club")).toBeInTheDocument();
  });

  it("edits the group's battle stats and saves them for every member (BATL-NEW-07)", async () => {
    const user = userEvent.setup();
    const onSaveOverride = vi.fn().mockResolvedValue(undefined);

    render(
      <ActiveHenchmenGroupCard
        groupName="Youngbloods"
        groupType="Youngblood"
        members={[createMember("henchman:1", "Lad One"), createMember("henchman:2", "Lad Two")]}
        canInteract
        unitInformationByKey={{}}
        killTargetOptions={[]}
        onSetOutOfAction={vi.fn().mockResolvedValue(undefined)}
        onAdjustWounds={vi.fn().mockResolvedValue(undefined)}
        onSaveOverride={onSaveOverride}
        onSaveUnitNotes={vi.fn().mockResolvedValue(undefined)}
        onRecordKill={vi.fn().mockResolvedValue(undefined)}
        onUseSingleUseItem={vi.fn().mockResolvedValue(undefined)}
        getUsedSingleUseItemCount={() => 0}
        activeItemActionKey={null}
      />
    );

    await user.click(screen.getByLabelText("Details for Youngbloods"));
    await user.click(screen.getByRole("button", { name: "Edit stats" }));
    const toughness = screen.getAllByRole("spinbutton")[4];
    await user.clear(toughness);
    await user.type(toughness, "4");
    await user.click(screen.getByRole("button", { name: "Apply stat changes" }));

    expect(onSaveOverride).toHaveBeenCalledWith(["henchman:1", "henchman:2"], {
      stats: { toughness: 4 },
    });
  });
});
