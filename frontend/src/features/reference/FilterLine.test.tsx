import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import { FilterLine, FilterSelect } from "./FilterLine";

const TYPES = [
  { id: "all", label: "All", count: 12 },
  { id: "melee", label: "Melee", count: 7 },
  { id: "ranged", label: "Ranged", count: 5 },
] as const;

const SORT = {
  options: [
    { id: "name", label: "Name" },
    { id: "cost", label: "Cost: low to high" },
  ],
  value: "name",
  onChange: () => {},
};

const line = (isMobile: boolean, onType = vi.fn(), sort = SORT) =>
  render(
    <FilterLine isMobile={isMobile} sort={sort}>
      <FilterSelect
        label="Type"
        allLabel="All types"
        options={TYPES}
        value="all"
        onChange={onType}
        isMobile={isMobile}
      />
      <FilterSelect
        label="Setting"
        options={[
          { id: "all", label: "All settings" },
          { id: "mordheim", label: "Mordheim" },
        ]}
        value="mordheim"
        onChange={() => {}}
        isMobile={isMobile}
      />
    </FilterLine>
  );

// William, 26 Nov 2026: the type and setting as dropdowns; the sort a phone's button, the web's headings
describe("FilterLine", () => {
  it("is the page's dropdowns on the web, each choice with its count, and no sort button", async () => {
    const onType = vi.fn();
    const user = setupUser();
    line(false, onType);

    const type = screen.getByRole("combobox", { name: "Type" });
    expect(type).toHaveTextContent("All types");
    expect(screen.getByRole("combobox", { name: "Setting" })).toHaveTextContent("Mordheim");
    expect(screen.queryByRole("button", { name: /^Sorted by/ })).toBeNull();

    await pickOption(user, type, /Ranged/);
    expect(onType).toHaveBeenCalledWith("ranged");
    await user.click(type);
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "All types12",
      "Melee7",
      "Ranged5",
    ]);
  });

  it("ends a phone's line with the sort button, only where there is more than one order", () => {
    line(true);
    expect(screen.getByRole("button", { name: "Sorted by Name" })).toBeInTheDocument();
  });

  it("shows nothing on a phone with no filter and one order", () => {
    const { container } = render(
      <FilterLine isMobile sort={{ ...SORT, options: SORT.options.slice(0, 1) }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
