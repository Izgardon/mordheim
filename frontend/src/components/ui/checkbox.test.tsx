import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setupUser } from "@/test/user-event";

import { CheckboxField } from "./checkbox";

function Large({ inline }: { inline?: boolean | "sm" }) {
  const [on, setOn] = useState(false);
  return (
    <CheckboxField inline={inline} checked={on} onChange={(event) => setOn(event.target.checked)}>
      Large target
    </CheckboxField>
  );
}

describe("CheckboxField", () => {
  it("is one label: its words tick the box as the box does", async () => {
    const user = setupUser();
    render(<Large />);

    const box = screen.getByRole("checkbox", { name: "Large target" });
    await user.click(screen.getByText("Large target"));
    expect(box).toBeChecked();
    await user.click(box);
    expect(box).not.toBeChecked();
  });

  it("sits inline as tall as the input beside it, at the row's foot", () => {
    const { rerender } = render(<Large inline />);
    const label = () => screen.getByText("Large target").closest("label");

    expect(label()).toHaveClass("self-end", "h-9", "md:h-11");
    rerender(<Large inline="sm" />);
    expect(label()).toHaveClass("h-8", "md:h-9");
    rerender(<Large />);
    expect(label()).not.toHaveClass("self-end");
  });
});
