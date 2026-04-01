import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BattleParticipant } from "@/features/battles/types/battle-types";

import BattleDesktopSubnav from "./BattleDesktopSubnav";

function createParticipant(userId: number, warbandName: string): BattleParticipant {
  return {
    id: userId,
    battle_id: 1,
    status: "joined_prebattle",
    connection_state: "online",
    last_event_id: 0,
    invited_by_user_id: null,
    invited_at: null,
    responded_at: null,
    joined_at: null,
    ready_at: null,
    canceled_at: null,
    battle_joined_at: null,
    finished_at: null,
    confirmed_at: null,
    last_seen_at: null,
    selected_unit_keys_json: [],
    unit_information_json: {},
    custom_units_json: [],
    postbattle_json: {},
    declared_rating: null,
    user: {
      id: userId,
      label: `User ${userId}`,
    },
    warband: {
      id: userId,
      name: warbandName,
    },
  };
}

describe("BattleDesktopSubnav", () => {
  it("renders participant tabs in the provided order", () => {
    render(
      <BattleDesktopSubnav
        title="Battle"
        subtitle="Session #1"
        participants={[
          createParticipant(7, "My Warband"),
          createParticipant(3, "Red Knives"),
          createParticipant(5, "Black Skulls"),
        ]}
        selectedParticipantUserId={7}
        onSelectParticipant={vi.fn()}
      />
    );

    const tabNames = screen
      .getAllByRole("button")
      .map((button) => button.textContent)
      .filter((value): value is string => Boolean(value));

    expect(tabNames).toEqual(expect.arrayContaining(["My Warband", "Red Knives", "Black Skulls"]));
    expect(tabNames.indexOf("My Warband")).toBeLessThan(tabNames.indexOf("Red Knives"));
    expect(tabNames.indexOf("Red Knives")).toBeLessThan(tabNames.indexOf("Black Skulls"));
  });

  it("switches participants when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelectParticipant = vi.fn();

    render(
      <BattleDesktopSubnav
        title="Battle"
        participants={[createParticipant(7, "My Warband"), createParticipant(3, "Red Knives")]}
        selectedParticipantUserId={7}
        onSelectParticipant={onSelectParticipant}
      />
    );

    await user.click(screen.getByRole("button", { name: "Red Knives" }));
    expect(onSelectParticipant).toHaveBeenCalledWith(3);
  });

  it("renders named action buttons in the right slot", () => {
    render(
      <BattleDesktopSubnav
        title="Battle"
        participants={[createParticipant(7, "My Warband")]}
        selectedParticipantUserId={7}
        onSelectParticipant={vi.fn()}
        actions={
          <>
            <button type="button">Ranged</button>
            <button type="button">Melee</button>
            <button type="button">Critical Hits</button>
          </>
        }
      />
    );

    expect(screen.getByRole("button", { name: "Ranged" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Melee" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Critical Hits" })).toBeInTheDocument();
  });
});
