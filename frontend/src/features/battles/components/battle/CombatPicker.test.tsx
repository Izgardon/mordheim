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
  it("offers only the models, under their headings (William, 25 Nov 2026)", async () => {
    const user = setupUser();
    render(<CombatPicker label="Yours" options={OPTIONS} value="hero:1" onChange={vi.fn()} />);

    const picker = screen.getByRole("combobox", { name: "Yours" });
    expect(picker).toHaveTextContent("Vrask the Hidden");
    await user.click(picker);
    expect(screen.queryByRole("option", { name: "Type the numbers" })).toBeNull();

    const heroes = screen.getByRole("group", { name: "Heroes" });
    expect(
      within(heroes)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["Vrask the Hidden", "Krekk Blackfur"]);
    expect(screen.getByRole("group", { name: "Henchmen" })).toHaveTextContent("Verminkin 1");
  });

  it("sends the model's key", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(<CombatPicker label="Theirs" options={OPTIONS} value="hero:1" onChange={onChange} />);

    await pickOption(user, screen.getByRole("combobox", { name: "Theirs" }), "Verminkin 1");
    expect(onChange).toHaveBeenLastCalledWith("henchman:4");
  });

  it("shows no picker with no models: the numbers are typed", () => {
    render(<CombatPicker label="Theirs" options={[]} value="" onChange={vi.fn()} />);

    expect(screen.getByText("Theirs")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
