/**
 * A switched-on mount or pet brings its beast's skills, specials and spells to the unit's lists
 * (the bestiary rewrite, step 5): each after the unit's own, marked with the mount or pet icon and
 * the beast's name, read-only (no menu, never pending), and opening its card like any entry.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UnitListBlocks from "./UnitListBlocks";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeItem, makeSkill, makeVeteranHero } from "@/test/warband-fixtures";

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));
// The entry's card: what it opened, without reading the catalogue.
vi.mock("../shared/unit_details/DetailPopup", () => ({
  default: ({ entry }: { entry: { type: string; id: number } }) => (
    <div role="dialog" aria-label={`${entry.type} ${entry.id}`} />
  ),
}));

const riding = makeVeteranHero({
  skills: [makeSkill({ id: 299, name: "New Skill", type: "Pending" })],
  mount: {
    item_row_id: 2,
    item_id: 140,
    name: "Warhorse",
    movement: 8,
    rating_bonus: 5,
    has_profile: true,
    stats: null,
    skills: [{ id: 900, name: "Thunderous Charge", type: "Mount" }],
    specials: [],
    spells: [],
  },
  pets: [
    {
      item_row_id: 3,
      item_id: 141,
      name: "Raven",
      has_profile: false,
      stats: null,
      specials: [{ id: 902, name: "Sharp Eyes", type: "Ability", description: "" }],
    },
  ],
});

describe("a unit's lists: its companions' entries", () => {
  it("marks each with its beast, read-only, after the unit's own", () => {
    renderWithQueryClient(
      <UnitListBlocks kind={heroKind} unit={riding} warbandId={9} variant="detailed" canEdit />,
      {}
    );

    const charge = screen.getByRole("button", { name: "Thunderous Charge (from Warhorse, mount)" });
    const row = charge.closest(".unit-list-entry") as HTMLElement;
    expect(within(row).getByText("Warhorse")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(row).not.toHaveClass("unit-list-entry--pending");
    expect(
      screen.getByRole("button", { name: "Sharp Eyes (from Raven, pet)" })
    ).toBeInTheDocument();
  });

  it("lets a companion's mark wrap under its name in a narrow column, and not the unit's own", () => {
    // At ~1100 px the card's four loadout columns are ~130 px wide: the mark and a spell's DC
    // squeezed the name to a letter per line ("Lu / ck / of / Sh..."). Its row now wraps instead.
    renderWithQueryClient(
      <UnitListBlocks kind={heroKind} unit={riding} warbandId={9} variant="detailed" canEdit />,
      {}
    );

    const charge = screen.getByRole("button", { name: "Thunderous Charge (from Warhorse, mount)" });
    expect(charge.closest(".unit-list-entry")).toHaveClass("flex-wrap");
    expect(charge).toHaveClass("flex-auto");
    expect(charge).not.toHaveClass("flex-1");
    const own = screen.getByRole("button", { name: "New Skill" });
    expect(own.closest(".unit-list-entry")).not.toHaveClass("flex-wrap");
    expect(own).toHaveClass("flex-1");
  });

  it("opens a companion's skill like any other, and never as a pending pick", async () => {
    const user = setupUser();
    const onPendingSkillClick = vi.fn();
    renderWithQueryClient(
      <UnitListBlocks
        kind={heroKind}
        unit={riding}
        warbandId={9}
        variant="detailed"
        canEdit
        onPendingSkillClick={onPendingSkillClick}
      />,
      {}
    );

    await user.click(
      screen.getByRole("button", { name: "Thunderous Charge (from Warhorse, mount)" })
    );

    expect(onPendingSkillClick).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "skill 900" })).toBeInTheDocument();
  });
});

describe("a ridden mount's item row", () => {
  it("lets its switch and menu wrap under its name in a narrow column", () => {
    // "Warh / orse": the switch and the menu left a ~40 px name in a ~96 px column.
    const horse = {
      ...makeItem({ id: 140, name: "Warhorse", type: "Animal" }),
      beast_kind: "mount" as const,
    };
    const rope = makeItem({ id: 150, name: "Rope" });
    const mounted = makeVeteranHero({
      ...riding,
      items: [{ ...horse, row_id: 2, companion: true }, rope],
    });
    renderWithQueryClient(
      <UnitListBlocks kind={heroKind} unit={mounted} warbandId={9} variant="detailed" canEdit />,
      {}
    );

    const ridden = screen.getByRole("button", { name: "Warhorse (ridden)" });
    expect(ridden.closest(".unit-list-entry")).toHaveClass("flex-wrap");
    expect(ridden).toHaveClass("flex-auto");
    expect(
      screen.getByRole("button", { name: "Rope" }).closest(".unit-list-entry")
    ).not.toHaveClass("flex-wrap");
  });

  it("opens the beast's profile and entries; a spare copy opens the item's card", async () => {
    const user = setupUser();
    const horse = {
      ...makeItem({ id: 140, name: "Warhorse", type: "Animal" }),
      beast_kind: "mount" as const,
    };
    const twoHorses = makeVeteranHero({
      ...riding,
      items: [
        { ...horse, row_id: 2, companion: true },
        { ...horse, row_id: 5, companion: false },
      ],
    });
    renderWithQueryClient(
      <UnitListBlocks kind={heroKind} unit={twoHorses} warbandId={9} variant="detailed" />,
      {}
    );

    await user.click(screen.getByRole("button", { name: "Warhorse (ridden)" }));
    const profile = screen.getByRole("dialog", { name: "Warhorse" });
    expect(within(profile).getByText("Skills:").parentElement).toHaveTextContent(
      "Skills: Thunderous Charge"
    );
    await user.click(within(profile).getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Warhorse" }));
    expect(await screen.findByRole("dialog", { name: "item 140" })).toBeInTheDocument();
  });
});
