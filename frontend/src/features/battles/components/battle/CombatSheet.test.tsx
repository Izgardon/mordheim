/**
 * Melee and Ranged: the numbers he came for sit at the top, and each critical hit table is
 * minimised under them (William, 12 Nov 2026: "in battle crit hits minimisable"). A table he
 * opens stays open on this device, so it survives the sheet re-rendering as he types.
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import CombatSheet from "./CombatSheet";
import { CRIT_TABLES_OPEN_KEY } from "./CriticalTables";

const BLUDGEONING = "Critical hits · Bludgeoning Weapons";
const HAMMERED = /Hammered\. The target is knocked off balance/;

const show = () =>
  render(<CombatSheet kind="melee" yours={[]} theirs={[]} onOpenChange={vi.fn()} />);

beforeEach(() => window.localStorage.clear());

describe("the combat sheet's critical hit tables", () => {
  it("leaves every table minimised, so the results are not buried", () => {
    show();

    expect(screen.getByRole("button", { name: BLUDGEONING })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByText(HAMMERED)).toBeNull();
  });

  it("opens a table when it is picked", async () => {
    const user = setupUser();
    show();

    await user.click(screen.getByRole("button", { name: BLUDGEONING }));

    expect(screen.getByText(HAMMERED)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CRIT_TABLES_OPEN_KEY) ?? "[]")).toContain(
      "bludgeoning"
    );
  });

  it("keeps a table open on this device, through a re-render and the next sheet", async () => {
    const user = setupUser();
    const first = show();
    await user.click(screen.getByRole("button", { name: BLUDGEONING }));
    first.unmount();

    show();

    expect(screen.getByText(HAMMERED)).toBeInTheDocument();
  });
});

describe("the combat sheet's layout", () => {
  const numbers = (side: string) =>
    within(screen.getByRole("group", { name: side }))
      .getAllByRole("spinbutton")
      .map((box) => box.getAttribute("aria-label"));

  it("puts Yours and Theirs side by side, each picker over its own numbers", () => {
    render(<CombatSheet kind="melee" yours={[]} theirs={[]} onOpenChange={vi.fn()} />);

    const yours = screen.getByRole("group", { name: "Yours" });
    const theirs = screen.getByRole("group", { name: "Theirs" });
    expect(yours.parentElement).toBe(theirs.parentElement);
    // a thin rule between them, and Theirs mirrored: its names on the right (William, 24 Nov 2026)
    expect(yours.nextElementSibling).toHaveClass("bg-line");
    expect(within(theirs).getByText("Theirs")).toHaveClass("text-right");
    // each side's numbers start right under its picker, whichever side has more of them
    expect(within(yours).getByText("Yours")).not.toHaveClass("flex-1");
    expect(within(theirs).getByLabelText("T").closest("label")).toHaveClass("text-right");
    expect(within(yours).getByLabelText("S").closest("label")).not.toHaveClass("text-right");
    expect(numbers("Yours")).toEqual(["WS", "S"]);
    expect(numbers("Theirs")).toEqual(["WS", "T", "Sv"]);
  });

  it("asks Ranged for your BS and their T and Sv", () => {
    render(<CombatSheet kind="ranged" yours={[]} theirs={[]} onOpenChange={vi.fn()} />);

    expect(numbers("Yours")).toEqual(["BS", "S"]);
    expect(numbers("Theirs")).toEqual(["T", "Sv"]);
  });
});

describe("the Misfire chart (William, 24 Nov 2026)", () => {
  const MISFIRE = "Misfire chart · Blackpowder Weapons";

  it("sits in Ranged under the missile critical hits, minimised like them", async () => {
    const user = setupUser();
    render(<CombatSheet kind="ranged" yours={[]} theirs={[]} onOpenChange={vi.fn()} />);

    const bars = screen
      .getAllByRole("button", { expanded: false })
      .map((button) => button.textContent);
    expect(bars).toEqual(["Critical hits · Missile Weapons", MISFIRE]);

    await user.click(screen.getByRole("button", { name: MISFIRE }));
    expect(
      screen.getByText(/KA-BOOM! The shot hits the target at \+1 Strength/)
    ).toBeInTheDocument();
  });

  it("is not in Melee", () => {
    show();
    expect(screen.queryByRole("button", { name: MISFIRE })).toBeNull();
  });
});

describe('the pickers\' first pick (William, 25 Nov 2026: "just default to the top result")', () => {
  const yours = [
    {
      key: "hero:1",
      name: "Captain Wolf",
      stats: { weapon_skill: 4, ballistic_skill: 5, strength: 3 },
      section: "Heroes",
    },
    { key: "hero:2", name: "Sergeant", stats: { weapon_skill: 3, strength: 4 }, section: "Heroes" },
  ];
  const theirs = [
    {
      key: "hero:9",
      name: "Black Fang",
      stats: { weapon_skill: 5, toughness: 4, armour_save: 5 },
      section: "Heroes",
    },
  ];
  const box = (side: string, label: string) =>
    within(screen.getByRole("group", { name: side })).getByLabelText(label);

  it("starts Yours and Theirs on their top model, its numbers filled in", () => {
    render(<CombatSheet kind="melee" yours={yours} theirs={theirs} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Yours" })).toHaveTextContent("Captain Wolf");
    expect(screen.getByRole("combobox", { name: "Theirs" })).toHaveTextContent("Black Fang");
    expect(box("Yours", "WS")).toHaveValue(4);
    expect(box("Yours", "S")).toHaveValue(3);
    expect(box("Theirs", "WS")).toHaveValue(5);
    expect(box("Theirs", "T")).toHaveValue(4);
    expect(box("Theirs", "Sv")).toHaveValue(5);
  });

  it("reads your BS for Ranged, and the boxes stay typeable", async () => {
    const user = setupUser();
    render(<CombatSheet kind="ranged" yours={yours} theirs={theirs} onOpenChange={vi.fn()} />);

    expect(box("Yours", "BS")).toHaveValue(5);
    await user.clear(box("Theirs", "T"));
    await user.type(box("Theirs", "T"), "6");
    expect(box("Theirs", "T")).toHaveValue(6);
  });

  it("offers no Type the numbers, and no picker at all with nobody to pick", async () => {
    const user = setupUser();
    render(<CombatSheet kind="melee" yours={yours} theirs={[]} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole("combobox", { name: "Theirs" })).toBeNull();
    expect(box("Theirs", "T")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Yours" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Captain Wolf",
      "Sergeant",
    ]);
  });
});
