import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("is a switch that reports its state and asks for the other one when pressed", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={onCheckedChange}>
        What I can buy
      </Switch>
    );

    const control = screen.getByRole("switch", { name: "What I can buy" });
    expect(control).toHaveAttribute("aria-checked", "false");
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    rerender(
      <Switch checked onCheckedChange={onCheckedChange}>
        What I can buy
      </Switch>
    );
    expect(control).toHaveAttribute("aria-checked", "true");
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("does nothing while disabled", () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} disabled aria-label="XP" />);

    fireEvent.click(screen.getByRole("switch", { name: "XP" }));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
