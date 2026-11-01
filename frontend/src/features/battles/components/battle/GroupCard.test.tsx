import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import { battleRosters, ME, myParticipant } from "@/test/battle-fixtures";
import { setupUser } from "@/test/user-event";

import { battleSections } from "./battle-units";
import GroupCard from "./GroupCard";

function renderGroup(information: Parameters<typeof myParticipant>[0] = {}) {
  const participant = myParticipant(information);
  const [entry] = battleSections(participant, toParticipantRosters(battleRosters())[ME.id]).groups;
  const onWounds = vi.fn();
  const onNote = vi.fn();
  render(
    <GroupCard
      entry={entry}
      canAct
      savingKeys={{}}
      onKill={vi.fn()}
      onCycle={vi.fn()}
      onWounds={onWounds}
      onOpen={vi.fn()}
      onNote={onNote}
    />
  );
  return { onWounds, onNote };
}

describe("GroupCard", () => {
  it("gives each henchman wound buttons, as a hero has", async () => {
    const user = setupUser();
    const { onWounds } = renderGroup();

    expect(screen.getByRole("group", { name: "Wounds for Youngblood A" })).toHaveTextContent(
      "W 1/1"
    );
    expect(screen.getByRole("button", { name: "Youngblood A heals a wound" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Youngblood A loses a wound" }));

    expect(onWounds).toHaveBeenCalledWith("henchman:2", -1);
  });

  it("shows the shared wounds and offers none to a model out of action", () => {
    renderGroup({ unit_information_json: { "henchman:2": { current_wounds: 0 } } });
    expect(screen.getByRole("group", { name: "Wounds for Youngblood A" })).toHaveTextContent(
      "W 0/1"
    );

    renderGroup({ unit_information_json: { "henchman:2": { out_of_action: true } } });
    const [, out] = screen.getAllByRole("button", { name: "Youngblood A loses a wound" });
    expect(out).toBeDisabled();
  });
});

describe("GroupCard notes", () => {
  it("opens the group's battle note from its small button and shows its first line", async () => {
    const user = setupUser();
    const { onNote } = renderGroup({
      unit_information_json: { "henchman:2": { notes: "Carrying the shard" } },
    });

    expect(screen.getByText("Carrying the shard")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Note for Youngblood A: Carrying the shard" })
    );

    expect(onNote).toHaveBeenCalledWith("henchman:2");
  });
});
