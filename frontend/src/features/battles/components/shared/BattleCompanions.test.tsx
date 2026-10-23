/**
 * Beasts in battle mode, the display parts of the bestiary rewrite's step 4: a rider carries the
 * mount's mark and shows the roster's `effectiveStats` M and save, highlighted with the foot
 * values in a tooltip (a battle stat change wins); pets show as chips on their unit; a creature
 * group carries the creature mark. Prebattle and active battles alike.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ActiveHenchmenGroupCard from "../active/ActiveHenchmenGroupCard";
import ActiveUnitCard from "../active/ActiveUnitCard";
import PrebattleParticipantRoster from "../prebattle/PrebattleParticipantRoster";

import type { BattleParticipant } from "@/features/battles/types/battle-types";
import type { PrebattleUnit } from "../prebattle/prebattle-types";

vi.mock("../active/ActiveKillDialog", () => ({ default: () => null }));

const stats = {
  movement: 4,
  weapon_skill: 4,
  ballistic_skill: 4,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 4,
  attacks: 1,
  leadership: 8,
  armour_save: 5,
};
const warhorse = {
  itemId: 140,
  name: "Warhorse",
  hasProfile: true,
  stats: { ...stats, movement: 8, armour_save: null },
  movement: 8,
  ratingBonus: 5,
};
const raven = { itemId: 141, name: "Raven", hasProfile: false, stats: null };

const rider: PrebattleUnit = {
  key: "hero:1",
  id: 1,
  kind: "hero",
  displayName: "Aldric the Bold",
  unitType: "Captain",
  stats,
  mount: warhorse,
  pets: [raven],
  effectiveStats: { movement: 8, armour_save: 4 },
};
const outrider = (id: number, mounted: boolean): PrebattleUnit => ({
  key: `henchman:${id}`,
  id,
  kind: "henchman",
  displayName: `Outrider ${id}`,
  unitType: "Outriders",
  stats: { ...stats, armour_save: 6 },
  mount: mounted ? warhorse : null,
  pets: [],
  effectiveStats: mounted ? { movement: 8, armour_save: 5 } : null,
});

const activeCardProps = {
  canInteract: true,
  killTargetOptions: [],
  onSetOutOfAction: vi.fn().mockResolvedValue(undefined),
  onAdjustWounds: vi.fn().mockResolvedValue(undefined),
  onSaveOverride: vi.fn().mockResolvedValue(undefined),
  onSaveUnitNotes: vi.fn().mockResolvedValue(undefined),
  onRecordKill: vi.fn().mockResolvedValue(undefined),
  onUseSingleUseItem: vi.fn().mockResolvedValue(undefined),
  getUsedSingleUseItemCount: () => 0,
  activeItemActionKey: null,
};

/** The value cell under a stats table's header ("M", "AS"). */
const statCell = (table: HTMLElement, label: string) => {
  const headers = within(table).getAllByRole("columnheader");
  const index = headers.findIndex((header) => header.textContent === label);
  return within(table).getAllByRole("cell")[index];
};

describe("active battle: a rider", () => {
  it("carries his mount's mark and pets, and shows the mounted M and save with the foot values", async () => {
    const user = userEvent.setup();
    render(<ActiveUnitCard unit={rider} {...activeCardProps} />);

    expect(screen.getByRole("img", { name: "Rides Warhorse" })).toBeInTheDocument();
    expect(screen.getByText("Raven")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(statCell(table, "M")).getByText("8")).toHaveAttribute("data-mounted", "true");
    expect(statCell(table, "AS")).toHaveTextContent("4+");
    await user.hover(within(statCell(table, "M")).getByText("8"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("On foot: 4");
  });

  it("lets a battle stat change win over the mount's Move", () => {
    render(
      <ActiveUnitCard
        unit={rider}
        unitInformation={{
          stats_override: { movement: 6 },
          out_of_action: false,
          kill_count: 0,
        }}
        {...activeCardProps}
      />
    );

    const table = screen.getByRole("table");
    expect(statCell(table, "M")).toHaveTextContent(/^6$/);
    expect(within(statCell(table, "AS")).getByText("4+")).toHaveAttribute("data-mounted", "true");
  });
});

describe("review findings", () => {
  it("shows two pets of one item as two chips, with no duplicate key", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ActiveUnitCard unit={{ ...rider, pets: [raven, raven] }} {...activeCardProps} />);

    expect(screen.getAllByText("Raven")).toHaveLength(2);
    expect(errors.mock.calls.flat().join(" ")).not.toMatch(/same key/);
    errors.mockRestore();
  });

  it("shows a group's foot stats when its members ride mounts of different Move", () => {
    const pony = { ...outrider(3, true), effectiveStats: { movement: 7, armour_save: 5 } };
    render(
      <ActiveHenchmenGroupCard
        groupName="Outriders"
        groupType="Outriders"
        members={[outrider(2, true), pony]}
        unitInformationByKey={{}}
        {...activeCardProps}
      />
    );

    expect(statCell(screen.getByRole("table"), "M")).toHaveTextContent(/^4$/);
  });
});

describe("active battle: a henchmen group", () => {
  it("marks a creature group, and each member who rides", () => {
    render(
      <ActiveHenchmenGroupCard
        groupName="Kennel"
        groupType="Wardogs"
        beastKind="creature"
        members={[outrider(2, false)]}
        unitInformationByKey={{}}
        {...activeCardProps}
      />
    );
    expect(screen.getByRole("img", { name: "Creature" })).toBeInTheDocument();
  });

  it("shows the mounted stats when every member rides, and the mark on each rider", () => {
    const { unmount } = render(
      <ActiveHenchmenGroupCard
        groupName="Outriders"
        groupType="Outriders"
        members={[outrider(2, true), outrider(3, true)]}
        unitInformationByKey={{}}
        {...activeCardProps}
      />
    );
    expect(screen.getAllByRole("img", { name: "Rides Warhorse" })).toHaveLength(2);
    expect(screen.queryByRole("img", { name: "Creature" })).not.toBeInTheDocument();
    let table = screen.getByRole("table");
    expect(within(statCell(table, "M")).getByText("8")).toHaveAttribute("data-mounted", "true");
    unmount();

    render(
      <ActiveHenchmenGroupCard
        groupName="Outriders"
        groupType="Outriders"
        members={[outrider(2, true), outrider(3, false)]}
        unitInformationByKey={{}}
        {...activeCardProps}
      />
    );
    expect(screen.getAllByRole("img", { name: "Rides Warhorse" })).toHaveLength(1);
    table = screen.getByRole("table");
    expect(statCell(table, "M")).toHaveTextContent(/^4$/);
  });
});

describe("prebattle", () => {
  const participant = {
    id: 1,
    user: { id: 7, label: "Owner" },
    warband: { id: 101, name: "Iron Vultures" },
  } as unknown as BattleParticipant;

  it("marks the rider and the creature group, with pets and the mounted stats", () => {
    render(
      <PrebattleParticipantRoster
        participant={participant}
        editable={false}
        ratingInputValue="120"
        onRatingInputChange={() => undefined}
        participantRoster={{
          heroes: [rider],
          hirelings: [],
          henchmenGroups: [
            {
              id: 25,
              name: "Kennel",
              unitType: "Wardogs",
              sourceBeastId: 3,
              beastKind: "creature",
              members: [outrider(2, false)],
            },
          ],
        }}
        rosterLoading={false}
        participantSelectedKeys={[]}
        participantOverrides={{}}
        participantNotes={{}}
        participantCustomUnits={[]}
        selectedUnitKeys={[]}
        editingUnitKey={null}
        onToggleUnitSelection={() => undefined}
        onToggleEditingUnit={() => undefined}
        onUpdateOverrideStat={() => undefined}
        onUpdateUnitNotes={() => undefined}
        onClearUnitOverride={() => undefined}
        onRemoveCustomUnit={() => undefined}
        canUseItems={false}
        onUseSingleUseItem={() => undefined}
        getUsedSingleUseItemCount={() => 0}
        activeItemActionKey={null}
      />
    );

    expect(screen.getByRole("img", { name: "Rides Warhorse" })).toBeInTheDocument();
    expect(screen.getByText("Raven")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Creature" })).toBeInTheDocument();
    const [riderTable] = screen.getAllByRole("table");
    expect(within(statCell(riderTable, "M")).getByText("8")).toHaveAttribute(
      "data-mounted",
      "true"
    );
  });
});
