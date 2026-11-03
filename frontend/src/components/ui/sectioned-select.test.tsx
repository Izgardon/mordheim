import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import { SectionedSelect, sectionsOf, type SelectSection } from "./sectioned-select";

const SECTIONS: SelectSection[] = [
  { label: "Heroes", options: [{ value: "hero:1", label: "Vrask the Hidden" }] },
  { label: "Henchmen", options: [] },
  {
    label: "Hired swords",
    options: [{ value: "hireling:3", label: "Tisk" }],
  },
];

describe("SectionedSelect", () => {
  it("lists the options under their headings and leaves out an empty section", async () => {
    const user = setupUser();
    render(
      <SectionedSelect
        aria-label="Give to"
        placeholder="Give to…"
        value=""
        sections={SECTIONS}
        onValueChange={() => undefined}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Give to" });
    expect(trigger).toHaveTextContent("Give to…");
    await user.click(trigger);

    const heroes = screen.getByRole("group", { name: "Heroes" });
    expect(within(heroes).getByRole("option", { name: "Vrask the Hidden" })).toBeInTheDocument();
    const swords = screen.getByRole("group", { name: "Hired swords" });
    expect(within(swords).getByRole("option", { name: "Tisk" })).toBeInTheDocument();
    expect(screen.queryByText("Henchmen")).not.toBeInTheDocument();
  });

  it("sends the picked option's value", async () => {
    const user = setupUser();
    const onValueChange = vi.fn();
    render(
      <SectionedSelect
        aria-label="Give to"
        placeholder="Give to…"
        value=""
        sections={SECTIONS}
        onValueChange={onValueChange}
      />
    );

    await pickOption(user, screen.getByRole("combobox", { name: "Give to" }), "Tisk");

    expect(onValueChange).toHaveBeenCalledWith("hireling:3");
  });

  it("shows no heading over a section labelled with nothing", async () => {
    const user = setupUser();
    render(
      <SectionedSelect
        aria-label="Yours"
        value="typed"
        sections={[{ label: "", options: [{ value: "typed", label: "Type the numbers" }] }]}
        onValueChange={() => undefined}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Yours" }));

    expect(screen.getByRole("option", { name: "Type the numbers" })).toBeInTheDocument();
    expect(screen.getByRole("group")).not.toHaveAccessibleName();
  });
});

describe("sectionsOf", () => {
  it("puts each entry under its heading, in the headings' order", () => {
    const sections = sectionsOf(
      [
        { kind: "b", name: "Tisk" },
        { kind: "a", name: "Vrask" },
      ],
      [
        { key: "a", label: "Heroes" },
        { key: "b", label: "Hired swords" },
      ],
      (entry) => entry.kind,
      (entry) => ({ value: entry.name, label: entry.name })
    );

    expect(sections).toEqual([
      { label: "Heroes", options: [{ value: "Vrask", label: "Vrask" }] },
      { label: "Hired swords", options: [{ value: "Tisk", label: "Tisk" }] },
    ]);
  });
});
