/**
 * A rider's mount and a unit's pets bring their beasts' skills, specials and spells into battle
 * (the bestiary rewrite, step 5): the active unit's lists show them after its own, marked with the
 * mount or pet and the beast's name, and the mount's mark and each pet chip open a tooltip with
 * the beast's profile and its entries.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ActiveHenchmenGroupCard from "../active/ActiveHenchmenGroupCard";
import ActiveUnitCard from "../active/ActiveUnitCard";

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

const rider: PrebattleUnit = {
  key: "hero:1",
  id: 1,
  kind: "hero",
  displayName: "Aldric the Bold",
  unitType: "Captain",
  stats,
  skills: [{ id: 5, name: "Mighty Blow" }],
  mount: {
    itemId: 140,
    name: "Warhorse",
    hasProfile: true,
    stats: { ...stats, movement: 8, armour_save: null },
    movement: 8,
    ratingBonus: 5,
    skills: [{ id: 900, name: "Thunderous Charge" }],
    spells: [{ id: 902, name: "Hoof Hex", dc: "7" }],
  },
  pets: [
    {
      itemId: 141,
      name: "Raven",
      hasProfile: false,
      stats: null,
      specials: [{ id: 901, name: "Sharp Eyes" }],
    },
  ],
  effectiveStats: { movement: 8, armour_save: 4 },
};

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

describe("battle: a companion's entries", () => {
  it("lists them in the unit's tabs after its own, marked with the beast", async () => {
    const user = userEvent.setup();
    render(<ActiveUnitCard unit={rider} {...cardProps} />);

    await user.click(screen.getByRole("button", { name: "Details for Aldric the Bold" }));

    const charge = screen.getByRole("button", { name: "Thunderous Charge (from Warhorse, mount)" });
    expect(
      within(charge.closest(".unit-list-entry") as HTMLElement).getByText("Warhorse")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Mighty Blow" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hoof Hex (from Warhorse, mount)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sharp Eyes (from Raven, pet)" })
    ).toBeInTheDocument();
  });

  it("lets a companion's mark wrap under its name in a narrow column, and not the unit's own", async () => {
    // The mark and a spell's DC squeezed the name to a letter per line in a narrow column; a
    // companion's row now wraps them under the name instead.
    const user = userEvent.setup();
    render(<ActiveUnitCard unit={rider} {...cardProps} />);

    await user.click(screen.getByRole("button", { name: "Details for Aldric the Bold" }));

    const hex = screen.getByRole("button", { name: "Hoof Hex (from Warhorse, mount)" });
    expect(hex.closest(".unit-list-entry")).toHaveClass("flex-wrap");
    expect(hex).toHaveClass("flex-auto");
    const own = screen.getByRole("button", { name: "Mighty Blow" });
    expect(own.closest(".unit-list-entry")).not.toHaveClass("flex-wrap");
    expect(own).toHaveClass("flex-1");
  });

  it("shows the mount's profile and entries from its mark, and a pet's from its chip", async () => {
    const user = userEvent.setup();
    render(<ActiveUnitCard unit={rider} {...cardProps} />);

    await user.hover(screen.getByRole("img", { name: "Rides Warhorse" }));
    const mount = await screen.findByRole("tooltip");
    expect(mount).toHaveTextContent("Rides Warhorse");
    expect(mount).toHaveTextContent("M 8");
    expect(mount).toHaveTextContent("Skills: Thunderous Charge");
    expect(mount).toHaveTextContent("Spells: Hoof Hex (DC 7)");
    await user.unhover(screen.getByRole("img", { name: "Rides Warhorse" }));

    await user.hover(screen.getByText("Raven"));
    const tooltips = await screen.findAllByRole("tooltip");
    const pet = tooltips[tooltips.length - 1];
    expect(pet).toHaveTextContent("No profile");
    expect(pet).toHaveTextContent("Specials: Sharp Eyes");
  });
});

describe("review findings (step 5)", () => {
  it("keeps a pet that fights as its own model out of its owner's tabs", async () => {
    const user = userEvent.setup();
    const hawk = {
      key: "pet:hero:12",
      itemId: 150,
      name: "Hawk",
      hasProfile: true,
      stats,
      specials: [{ id: 903, name: "Swoop" }],
    };
    render(<ActiveUnitCard unit={{ ...rider, pets: [hawk] }} {...cardProps} />);

    await user.click(screen.getByRole("button", { name: "Details for Aldric the Bold" }));

    expect(screen.queryByText("Swoop")).not.toBeInTheDocument();
  });

  it("lets the keyboard open the mount's tooltip", async () => {
    const user = userEvent.setup();
    render(<ActiveUnitCard unit={rider} {...cardProps} />);

    await user.tab();

    expect(document.activeElement).toContainElement(
      screen.getByRole("img", { name: "Rides Warhorse" })
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Skills: Thunderous Charge");
  });

  it("lists every riding member's mount entries on a group's tabs, not one member's", async () => {
    const user = userEvent.setup();
    const member = (id: number, mount: PrebattleUnit["mount"]): PrebattleUnit => ({
      ...rider,
      key: `henchman:${id}`,
      id,
      kind: "henchman",
      displayName: `Outrider ${id}`,
      skills: [],
      pets: [],
      mount,
    });
    const pony = {
      ...rider.mount!,
      itemId: 160,
      name: "Pony",
      skills: [{ id: 905, name: "Sure-footed" }],
    };
    render(
      <ActiveHenchmenGroupCard
        groupName="Outriders"
        groupType="Outriders"
        members={[member(2, rider.mount), member(3, pony)]}
        unitInformationByKey={{
          "henchman:2": {
            stats_override: {},
            out_of_action: false,
            kill_count: 0,
            dismounted: true,
          },
        }}
        {...cardProps}
      />
    );

    await user.click(screen.getByRole("button", { name: "Details for Outriders" }));

    expect(
      screen.getByRole("button", { name: "Sure-footed (from Pony, mount)" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Thunderous Charge")).not.toBeInTheDocument(); // his rider is dismounted
  });
});
