import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NumberInput } from "./number-input";

function Field({ min, max, step }: { min?: number; max?: number; step?: number }) {
  const [value, setValue] = useState("1");
  return (
    <NumberInput
      aria-label="Models"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("NumberInput", () => {
  it("has − and + beside the field that step its value within min and max", () => {
    render(<Field min={0} max={3} />);
    const field = screen.getByRole("spinbutton", { name: "Models" });
    const more = screen.getByRole("button", { name: "More: Models" });
    const less = screen.getByRole("button", { name: "Less: Models" });

    fireEvent.click(more);
    fireEvent.click(more);
    expect(field).toHaveValue(3);
    fireEvent.click(more);
    expect(field).toHaveValue(3);
    for (let i = 0; i < 4; i++) fireEvent.click(less);
    expect(field).toHaveValue(0);
  });

  it("steps by its step, and typing still works", () => {
    render(<Field step={5} />);
    const field = screen.getByRole("spinbutton", { name: "Models" });
    fireEvent.change(field, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "More: Models" }));
    expect(field).toHaveValue(15);
  });
});
