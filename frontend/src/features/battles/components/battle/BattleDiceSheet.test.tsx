import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import BattleDiceSheet, { diceNotation, diceTotal } from "./BattleDiceSheet";

const open = () => render(<BattleDiceSheet open onOpenChange={vi.fn()} />);

describe("BattleDiceSheet", () => {
  it("offers the die types William kept, with 2D6 no longer one of them", () => {
    open();

    expect(screen.getByRole("button", { name: "D3", pressed: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "D6", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "D66", pressed: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2D6" })).not.toBeInTheDocument();
  });

  it("rolls as many dice as the stepper asks for", async () => {
    const user = setupUser();
    open();

    expect(screen.getByRole("button", { name: "Roll 2D6" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Raise dice" }));

    expect(screen.getByRole("button", { name: "Roll 3D6" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Roll 3D6" }));

    expect(screen.getAllByLabelText(/D6 rolled$/)).toHaveLength(3);
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("takes the number rolled at the table instead", async () => {
    const user = setupUser();
    open();

    await user.click(screen.getByRole("button", { name: "Lower dice" }));
    await user.type(screen.getByLabelText("D6 rolled"), "5");

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("throws a D66 once, so it takes no count", async () => {
    const user = setupUser();
    open();

    await user.click(screen.getByRole("button", { name: "D66" }));

    expect(screen.queryByRole("button", { name: "Raise dice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roll D66" })).toBeInTheDocument();
  });
});

describe("the dice themselves", () => {
  it("writes the roll as the rules do", () => {
    expect(diceNotation("D6", 1)).toBe("D6");
    expect(diceNotation("D6", 3)).toBe("3D6");
    expect(diceNotation("D3", 2)).toBe("2D3");
    expect(diceNotation("D66", 1)).toBe("D66");
  });

  it("reads a D66 as tens and units and adds the rest up", () => {
    expect(diceTotal("D66", [4, 2])).toBe(42);
    expect(diceTotal("D6", [4, 2, 6])).toBe(12);
    expect(diceTotal("D3", [3])).toBe(3);
  });
});
