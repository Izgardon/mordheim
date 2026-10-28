/**
 * A rider marked Dismounted for the rest of an active battle (the bestiary rewrite, step 5): his
 * player toggles it on his card or his henchman row; while dismounted he shows his foot M and
 * save (not highlighted), his mark says so, his mount's entries leave his tabs, and the helpers
 * use his foot stats. Others see the state, without the toggle.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ActiveHenchmenGroupCard from "./ActiveHenchmenGroupCard";
import ActiveUnitCard from "./ActiveUnitCard";
import { toUnitInformationMap } from "./active-utils";
import { helperStats } from "../../utils/battle-companions";

import type { PrebattleUnit } from "../prebattle/prebattle-types";

vi.mock("./ActiveKillDialog", () => ({ default: () => null }));

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
  skills: [{ id: 900, name: "Thunderous Charge" }],
};
const rider: PrebattleUnit = {
  key: "hero:1",
  id: 1,
  kind: "hero",
  displayName: "Aldric",
  unitType: "Captain",
  stats,
  mount: warhorse,
  pets: [
    {
      itemId: 141,
      name: "Raven",
      hasProfile: false,
      stats: null,
      skills: [{ id: 5, name: "Watch" }],
    },
  ],
  effectiveStats: { movement: 8, armour_save: 4 },
};
const outrider = (id: number): PrebattleUnit => ({
  ...rider,
  key: `henchman:${id}`,
  id,
  kind: "henchman",
  displayName: `Outrider ${id}`,
  pets: [],
});
const dismounted = { stats_override: {}, out_of_action: false, kill_count: 0, dismounted: true };

const cardProps = {
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

const statCell = (table: HTMLElement, label: string) => {
  const headers = within(table).getAllByRole("columnheader");
  return within(table).getAllByRole("cell")[
    headers.findIndex((header) => header.textContent === label)
  ];
};

describe("dismounting in an active battle", () => {
  it("lets the rider's player mark him dismounted from his card", async () => {
    const user = userEvent.setup();
    const onSetDismounted = vi.fn().mockResolvedValue(undefined);
    render(<ActiveUnitCard unit={rider} onSetDismounted={onSetDismounted} {...cardProps} />);

    const toggle = screen.getByRole("button", { name: "Aldric: Dismounted" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(onSetDismounted).toHaveBeenCalledWith("hero:1", true);
  });

  it("puts his foot M and save back, says so, and drops his mount's entries", async () => {
    const user = userEvent.setup();
    const onSetDismounted = vi.fn().mockResolvedValue(undefined);
    render(
      <ActiveUnitCard
        unit={rider}
        unitInformation={dismounted}
        onSetDismounted={onSetDismounted}
        {...cardProps}
      />
    );

    const table = screen.getByRole("table");
    expect(statCell(table, "M")).toHaveTextContent(/^4$/);
    expect(statCell(table, "AS")).toHaveTextContent(/^5\+$/);
    expect(screen.getByRole("img", { name: "Dismounted from Warhorse" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Aldric: Dismounted" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(onSetDismounted).toHaveBeenCalledWith("hero:1", false);

    await user.click(screen.getByRole("button", { name: "Details for Aldric" }));
    expect(screen.queryByText("Thunderous Charge")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watch (from Raven, pet)" })).toBeInTheDocument();
  });

  it("shows the others the state without the toggle, and offers none on foot", () => {
    const { unmount } = render(
      <ActiveUnitCard
        unit={rider}
        unitInformation={dismounted}
        {...cardProps}
        canInteract={false}
      />
    );
    expect(screen.getByText("Dismounted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aldric: Dismounted" })).not.toBeInTheDocument();
    unmount();

    render(
      <ActiveUnitCard
        unit={{ ...rider, mount: null, effectiveStats: null }}
        onSetDismounted={vi.fn()}
        {...cardProps}
      />
    );
    expect(screen.queryByRole("button", { name: /Dismounted/ })).not.toBeInTheDocument();
  });

  it("toggles a henchman, whose group then shows its foot stats", async () => {
    const user = userEvent.setup();
    const onSetDismounted = vi.fn().mockResolvedValue(undefined);
    render(
      <ActiveHenchmenGroupCard
        groupName="Outriders"
        groupType="Outriders"
        members={[outrider(2), outrider(3)]}
        unitInformationByKey={{ "henchman:3": dismounted }}
        onSetDismounted={onSetDismounted}
        {...cardProps}
      />
    );

    expect(statCell(screen.getByRole("table"), "M")).toHaveTextContent(/^4$/);
    await user.click(screen.getByRole("button", { name: "Outrider 2: Dismounted" }));
    expect(onSetDismounted).toHaveBeenCalledWith("henchman:2", true);
  });

  it("keeps the state through the page's unit information, and the helpers use foot stats", () => {
    const map = toUnitInformationMap({ "hero:1": { out_of_action: false, dismounted: true } });

    expect(map["hero:1"].dismounted).toBe(true);
    expect(helperStats(rider, {}, map["hero:1"])).toMatchObject({ movement: 4, armour_save: 5 });
    expect(helperStats(rider, {}, undefined)).toMatchObject({ movement: 8, armour_save: 4 });
  });
});
