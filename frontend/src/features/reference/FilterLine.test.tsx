import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import { BY_NAME_ONLY, FilterLine, FilterSelect } from "./FilterLine";

const TYPES = [
  { id: "all", label: "All", count: 12 },
  { id: "melee", label: "Melee", count: 7 },
  { id: "ranged", label: "Ranged", count: 5 },
] as const;

// William, 26 Nov 2026: "it goes Type filter, Setting filter, then a new sort icon button"
describe("FilterLine", () => {
  it("is the page's dropdowns, each choice with its count, then the sort's button", async () => {
    const onType = vi.fn();
    const user = setupUser();
    render(
      <FilterLine isMobile={false} sort={BY_NAME_ONLY}>
        <FilterSelect
          label="Type"
          allLabel="All types"
          options={TYPES}
          value="all"
          onChange={onType}
          isMobile={false}
        />
        <FilterSelect
          label="Setting"
          options={[
            { id: "all", label: "All settings" },
            { id: "mordheim", label: "Mordheim" },
          ]}
          value="mordheim"
          onChange={() => {}}
          isMobile={false}
        />
      </FilterLine>
    );

    const type = screen.getByRole("combobox", { name: "Type" });
    expect(type).toHaveTextContent("All types");
    expect(screen.getByRole("combobox", { name: "Setting" })).toHaveTextContent("Mordheim");
    expect(screen.getByRole("button", { name: "Sorted by Name" })).toBeInTheDocument();

    await pickOption(user, type, /Ranged/);
    expect(onType).toHaveBeenCalledWith("ranged");
    await user.click(type);
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "All types12",
      "Melee7",
      "Ranged5",
    ]);
  });
});
