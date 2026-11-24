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
    expect(yours.parentElement).toHaveClass("grid-cols-2");
    expect(within(yours).getByRole("combobox", { name: "Yours" })).toBeInTheDocument();
    expect(within(theirs).getByRole("combobox", { name: "Theirs" })).toBeInTheDocument();
    expect(numbers("Yours")).toEqual(["WS", "S"]);
    expect(numbers("Theirs")).toEqual(["WS", "T", "Sv"]);
  });

  it("asks Ranged for your BS and their T and Sv", () => {
    render(<CombatSheet kind="ranged" yours={[]} theirs={[]} onOpenChange={vi.fn()} />);

    expect(numbers("Yours")).toEqual(["BS", "S"]);
    expect(numbers("Theirs")).toEqual(["T", "Sv"]);
  });
});
