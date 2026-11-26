import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SortMenu from "./SortMenu";

const OPTIONS = [
  { id: "name", label: "Name" },
  { id: "setting", label: "Setting" },
  { id: "grade", label: "Grade" },
] as const;

// William, 24 Nov 2026: "Can the sort here be more obviously a sort as it seems like a filter"
describe("SortMenu", () => {
  it("is one button naming the order, which opens the orders with the current one ticked", async () => {
    const onChange = vi.fn();
    render(<SortMenu options={OPTIONS} value="setting" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Sorted by Setting" }));

    const orders = await screen.findAllByRole("menuitemradio");
    expect(orders.map((order) => order.textContent)).toEqual(["Name", "Setting", "Grade"]);
    expect(screen.getByRole("menuitemradio", { name: "Setting" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Grade" }));
    expect(onChange).toHaveBeenCalledWith("grade");
  });
});
