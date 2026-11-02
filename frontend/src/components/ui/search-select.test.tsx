import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  SearchCombobox,
  SearchMultiSelect,
  SearchSelect,
  filterOptions,
  type SearchOption,
} from "./search-select";

const SKILLS: SearchOption[] = [
  { id: 1, title: "Mighty Blow", subtitle: "Combat" },
  { id: 2, title: "Quick Shot", subtitle: "Shooting" },
  { id: 3, title: "Black Hunger", subtitle: "Skaven special", group: "Your warband's" },
  { id: 4, title: "Dodge", subtitle: "Speed", warning: "Not in his skill lists" },
];

describe("filterOptions", () => {
  it("matches the title, the subtitle or the keywords, keeping the order", () => {
    expect(filterOptions(SKILLS, "shoot").map((o) => o.id)).toEqual([2]);
    expect(filterOptions(SKILLS, " BLOW ").map((o) => o.id)).toEqual([1]);
    expect(filterOptions([{ id: 9, title: "Skaven", keywords: "MHR" }], "mhr")).toHaveLength(1);
    expect(filterOptions(SKILLS, "")).toHaveLength(4);
  });
});

describe("SearchCombobox", () => {
  it("is a combobox over a listbox whose rows carry titles, subtitles and warnings", async () => {
    render(<SearchCombobox label="Add skill" options={SKILLS} onPick={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Add skill" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox", { name: "Add skill" });
    expect(input).toHaveAttribute("aria-controls", list.id);
    const rows = within(list).getAllByRole("option");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("Shooting")).toBeInTheDocument();
    expect(within(list).getByText("Your warband's")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Not in his skill lists")).toBeInTheDocument();
  });

  it("filters as you type, moves with the arrows and picks with Enter", async () => {
    const onPick = vi.fn();
    render(<SearchCombobox label="Add skill" options={SKILLS} onPick={onPick} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "o");
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", rows[2].id);
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(onPick).toHaveBeenCalledWith(SKILLS[1]);
    expect(input).toHaveValue("");
  });

  it("wraps around, and picks a greyed row too (a warning, never a block)", async () => {
    const onPick = vi.fn();
    render(<SearchCombobox label="Add skill" options={SKILLS} onPick={onPick} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(onPick).toHaveBeenCalledWith(SKILLS[3]);
  });

  it("shows the empty row only when nothing matches", async () => {
    render(
      <SearchCombobox label="Add skill" options={SKILLS} onPick={vi.fn()} emptyText="No skill." />
    );
    await userEvent.type(screen.getByRole("combobox"), "mig");
    expect(screen.queryByText("No skill.")).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("combobox"), "zz");
    expect(screen.getByText("No skill.")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("closes on Escape, then hands Escape to the caller", async () => {
    const onDismiss = vi.fn();
    render(
      <SearchCombobox label="Add skill" options={SKILLS} onPick={vi.fn()} onDismiss={onDismiss} />
    );
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("offers what was typed as a new entry when no row has that name", async () => {
    const onCreate = vi.fn();
    render(
      <SearchCombobox
        label="Race"
        options={SKILLS}
        onPick={vi.fn()}
        create={{ label: (typed) => `Add “${typed}”`, onCreate }}
      />
    );
    await userEvent.type(screen.getByRole("combobox"), "Dodge");
    expect(screen.queryByRole("option", { name: "Add “Dodge”" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("combobox"), "r");
    await userEvent.keyboard("{Enter}");
    expect(onCreate).toHaveBeenCalledWith("Dodger");
  });
});

describe("SearchSelect", () => {
  it("shows the value with its subtitle, searches in its place, and clears", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchSelect
        label="Race"
        options={SKILLS}
        value={SKILLS[0]}
        onChange={onChange}
        clearLabel="No race"
      />
    );
    expect(screen.getByText("Combat")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Race: Mighty Blow" }));
    const input = screen.getByRole("combobox", { name: "Race" });
    expect(input).toHaveFocus();
    await userEvent.type(input, "quick{Enter}");
    expect(onChange).toHaveBeenCalledWith(SKILLS[1]);

    rerender(
      <SearchSelect
        label="Race"
        options={SKILLS}
        value={SKILLS[1]}
        onChange={onChange}
        clearLabel="No race"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "No race" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

function Multi({ initial }: { initial: SearchOption[] }) {
  const [values, setValues] = useState(initial);
  return (
    <SearchMultiSelect addLabel="Add skill" options={SKILLS} values={values} onChange={setValues} />
  );
}

describe("SearchMultiSelect", () => {
  it("adds from the search in the Add button's place, with subtitles on the chips, and removes", async () => {
    render(<Multi initial={[SKILLS[0]]} />);
    expect(screen.getByText("Combat")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add skill" }));
    const input = screen.getByRole("combobox", { name: "Add skill" });
    expect(input).toHaveFocus();
    // what is picked already isn't offered again
    expect(screen.queryByRole("option", { name: /Mighty Blow/ })).not.toBeInTheDocument();
    await userEvent.type(input, "black{Enter}");
    expect(screen.getByText("Skaven special")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
    await userEvent.keyboard("{Escape}{Escape}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add skill" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Mighty Blow" }));
    expect(screen.queryByText("Mighty Blow")).not.toBeInTheDocument();
  });

  it("keeps a chip within 200 px, its lines ending in … with the full text in their titles", () => {
    render(<Multi initial={[SKILLS[3]]} />);
    const chip = screen.getByText("Dodge").closest("span.inline-flex");
    expect(chip).toHaveClass("max-w-[200px]");
    for (const text of ["Dodge", "Speed", "Not in his skill lists"]) {
      expect(screen.getByText(text)).toHaveAttribute("title", text);
      expect(screen.getByText(text)).toHaveClass("truncate");
    }
  });
});
