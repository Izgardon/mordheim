import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoxTile } from "./box-tile";

describe("BoxTile", () => {
  it("is a plain box with its name and type line when nothing opens it", () => {
    render(<BoxTile name="Sword" type="Melee" />);

    expect(screen.getByText("Sword")).toBeInTheDocument();
    expect(screen.getByText("Melee")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is a toggle button when it opens a detail, reporting whether it is pressed", () => {
    const onClick = vi.fn();
    render(<BoxTile name="Warhorse" type="Mount" kind="mount" pressed onClick={onClick} />);

    const tile = screen.getByRole("button", { name: /Warhorse/ });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(tile).toHaveAttribute("data-kind", "mount");
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
