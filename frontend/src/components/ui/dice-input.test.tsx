import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setupUser } from "@/test/user-event";

import { DiceInput } from "./dice-input";

function Dice({ count = "", multiplier = "" }: { count?: string; multiplier?: string }) {
  const [value, setValue] = useState({ count, multiplier });
  return (
    <>
      <DiceInput
        label="Dice"
        count={value.count}
        multiplier={value.multiplier}
        onCountChange={(next) => setValue((current) => ({ ...current, count: next }))}
        onMultiplierChange={(next) => setValue((current) => ({ ...current, multiplier: next }))}
      />
      <output>{`${value.count}|${value.multiplier}`}</output>
    </>
  );
}

const count = () => screen.getByLabelText("Dice: how many D6");
const multiply = () => screen.queryByRole("button", { name: "Dice: multiply each pip" });
const multiplier = () => screen.queryByLabelText("Dice: each pip is worth");

describe("DiceInput", () => {
  it("is the count and D6 as one unit, the multiplier hidden behind a × once there are dice", async () => {
    const userEvent = setupUser();
    render(<Dice />);

    const unit = screen.getByRole("group", { name: "Dice" });
    expect(unit).toHaveTextContent("D6");
    expect(multiply()).toBeNull();
    await userEvent.type(count(), "2x");
    expect(count()).toHaveValue("2");
    expect(multiplier()).toBeNull();

    await userEvent.click(multiply()!);
    expect(multiplier()).toHaveFocus();
    await userEvent.type(multiplier()!, "25");
    expect(screen.getByRole("status")).toHaveTextContent("2|25");
  });

  it("shows a row's multiplier already open", () => {
    render(<Dice count="1" multiplier="25" />);

    expect(multiplier()).toHaveValue("25");
    expect(multiply()).toBeNull();
  });
});
