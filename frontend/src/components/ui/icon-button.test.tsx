import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("gives an icon button a 44 px square and its label", () => {
    render(
      <IconButton aria-label="Dice roller">
        <svg aria-hidden="true" />
      </IconButton>
    );

    const button = screen.getByRole("button", { name: "Dice roller" });
    expect(button).toHaveClass("h-11", "w-11");
  });
});
