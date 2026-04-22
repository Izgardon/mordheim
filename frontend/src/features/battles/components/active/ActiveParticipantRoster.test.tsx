import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ActiveParticipantRoster from "./ActiveParticipantRoster";

const participant = {
  id: 1,
  battle_id: 1,
  status: "in_battle" as const,
  connection_state: "online" as const,
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
  battle_notes: "",
  user: { id: 1, label: "Player One" },
  warband: { id: 11, name: "The Wolves" },
};

const baseProps = {
  participant,
  participantRoster: {
    heroes: [],
    henchmenGroups: [],
    hiredSwords: [],
  },
  rosterLoading: false,
  rosterError: undefined,
  unitInformationByKey: {},
  killTargetOptions: [],
  canInteract: false,
  onSetOutOfAction: vi.fn().mockResolvedValue(undefined),
  onAdjustWounds: vi.fn().mockResolvedValue(undefined),
  onSaveOverride: vi.fn().mockResolvedValue(undefined),
  onSaveUnitNotes: vi.fn().mockResolvedValue(undefined),
  onRecordKill: vi.fn().mockResolvedValue(undefined),
  onUseSingleUseItem: vi.fn().mockResolvedValue(undefined),
  getUsedSingleUseItemCount: () => 0,
  activeItemActionKey: null,
};

describe("ActiveParticipantRoster", () => {
  it("does not render the participant identity header", () => {
    render(<ActiveParticipantRoster {...baseProps} />);

    expect(screen.queryByText("Player One")).not.toBeInTheDocument();
    expect(screen.queryByText("The Wolves")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Open ranged helper")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Open melee helper")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Open critical hit reference")).not.toBeInTheDocument();
  });

  it("still shows the empty state when no units are selected", () => {
    render(<ActiveParticipantRoster {...baseProps} />);

    expect(screen.getByText("No units selected for this battle.")).toBeInTheDocument();
  });
});
