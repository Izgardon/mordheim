import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import RacePicker from "./RacePicker";
import { setupUser } from "@/test/user-event";
import { humanRace } from "@/test/warband-fixtures";

import type { Race } from "@/features/races/types/race-types";

vi.mock("@/features/races/components/CreateRaceDialog", () => ({ default: () => null }));

const dwarf: Race = { ...humanRace, id: 2, name: "Dwarf" };
const elf: Race = { ...humanRace, id: 3, name: "Elf" };

function Picker({ onSelect }: { onSelect: (race: Race) => void }) {
  const [query, setQuery] = useState("");
  return (
    <RacePicker
      variant="add"
      campaignId={1}
      races={[humanRace, dwarf, elf]}
      selectedRaceId={null}
      query={query}
      setQuery={setQuery}
      onType={vi.fn()}
      onSelect={onSelect}
      onCreated={vi.fn()}
    />
  );
}

describe("RacePicker (UX-02)", () => {
  it("is a combobox the keyboard can search, move through and pick from", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    render(<Picker onSelect={onSelect} />);

    const combobox = screen.getByRole("combobox", { name: "Race" });
    act(() => combobox.focus());
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Human", "Dwarf", "Elf"]);
    // The first match is highlighted as the list opens; the arrow keys move from there.
    await waitFor(() => expect(options[0]).toHaveAttribute("aria-selected", "true"));

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(dwarf);
    expect(combobox).toHaveValue("Dwarf");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("filters as you type and closes on Escape", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    render(<Picker onSelect={onSelect} />);
    const combobox = screen.getByRole("combobox", { name: "Race" });
    act(() => combobox.focus());

    await user.keyboard("e");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Elf"]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(elf);
  });
});
