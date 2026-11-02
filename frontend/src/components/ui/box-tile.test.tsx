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

  it("is at most 200 px wide, a long name and line ending in … with the full text in their titles", () => {
    const name = "Sword of Rezhebel, the Blade of the Ancients";
    const line = "Melee weapon · S As user +1 · Close Combat · Parry";
    render(<BoxTile name={name} type={line} kind="spell" onClick={() => undefined} />);

    const tile = screen.getByRole("button", { name: new RegExp(name) });
    expect(tile).toHaveClass("max-w-[200px]");
    expect(screen.getByText(name)).toHaveAttribute("title", name);
    expect(screen.getByText(name)).toHaveClass("truncate");
    expect(screen.getByText(line)).toHaveAttribute("title", line);
    expect(screen.getByText(line)).toHaveClass("truncate");
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
