import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chip, ChipLabel } from "./chip";

describe("Chip", () => {
  it("is a button reporting whether it is pressed", () => {
    render(
      <>
        <Chip pressed>Armour</Chip>
        <Chip>Melee</Chip>
      </>
    );

    expect(screen.getByRole("button", { name: "Armour" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Melee" })).toHaveAttribute("aria-pressed", "false");
  });

  it("only labels as a ChipLabel", () => {
    render(<ChipLabel tone="danger">Missing · 1 game</ChipLabel>);

    expect(screen.getByText("Missing · 1 game")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
