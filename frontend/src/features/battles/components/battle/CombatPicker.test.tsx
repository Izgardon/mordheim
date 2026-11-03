import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import CombatPicker, { type CombatOption } from "./CombatPicker";

const OPTIONS: CombatOption[] = [
  { key: "hero:1", name: "Vrask the Hidden", stats: {}, section: "Heroes" },
  { key: "henchman:4", name: "Verminkin 1", stats: {}, section: "Henchmen" },
  { key: "hero:2", name: "Krekk Blackfur", stats: {}, section: "Heroes" },
];

describe("CombatPicker", () => {
  it("offers Type the numbers, then the models under their headings", async () => {
    const user = setupUser();
    render(<CombatPicker label="Yours" options={OPTIONS} value="" onChange={vi.fn()} />);

    const picker = screen.getByRole("combobox", { name: "Yours" });
    expect(picker).toHaveTextContent("Type the numbers");
    await user.click(picker);

    const heroes = screen.getByRole("group", { name: "Heroes" });
    expect(
      within(heroes)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Vrask the Hidden", "Krekk Blackfur"]);
    expect(screen.getByRole("group", { name: "Henchmen" })).toHaveTextContent("Verminkin 1");
  });

  it("sends the model's key, and nothing for Type the numbers", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const { rerender } = render(
      <CombatPicker label="Theirs" options={OPTIONS} value="" onChange={onChange} />
    );

    await pickOption(user, screen.getByRole("combobox", { name: "Theirs" }), "Verminkin 1");
    expect(onChange).toHaveBeenLastCalledWith("henchman:4");

    rerender(
      <CombatPicker label="Theirs" options={OPTIONS} value="henchman:4" onChange={onChange} />
    );
    await pickOption(user, screen.getByRole("combobox", { name: "Theirs" }), "Type the numbers");
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
