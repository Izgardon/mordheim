/**
 * The battle menu (William, 25 Nov 2026: "a clearer divide between the top menu items and the
 * game ending items"): the fight's rows, then the ones that end it under their own heading.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import BattleMenuSheet, { type BattleMenuPart } from "./BattleMenuSheet";

const row = (label: string, onSelect = vi.fn()) => ({ label, detail: `${label} line`, onSelect });

describe("BattleMenuSheet", () => {
  it("parts the fight's rows from the ending ones, under End", () => {
    const sections: BattleMenuPart[] = [
      { id: "fight", rows: [row("Edit stats"), row("Battle notes")] },
      { id: "end", label: "End", rows: [row("End my battle"), row("Cancel the battle")] },
    ];
    render(<BattleMenuSheet open onOpenChange={vi.fn()} kicker="Skirmish" sections={sections} />);

    const end = screen.getByRole("region", { name: "End" });
    expect(within(end).getByRole("heading", { name: "End" })).toBeInTheDocument();
    expect(
      within(end)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["End my battleEnd my battle line", "Cancel the battleCancel the battle line"]);
    expect(within(end).queryByText("Edit stats")).toBeNull();
    expect(screen.queryByRole("button", { name: /Leave battle/ })).toBeNull();
  });

  it("closes and does what the row does", async () => {
    const user = setupUser();
    const onOpenChange = vi.fn();
    const notes = row("Battle notes");
    render(
      <BattleMenuSheet
        open
        onOpenChange={onOpenChange}
        kicker="Skirmish"
        sections={[{ id: "fight", rows: [notes] }]}
      />
    );

    await user.click(screen.getByRole("button", { name: /Battle notes/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(notes.onSelect).toHaveBeenCalled();
  });

  it("says so when there is nothing to do", () => {
    render(<BattleMenuSheet open onOpenChange={vi.fn()} kicker="Skirmish" sections={[]} />);

    expect(screen.getByText("Nothing to do here.")).toBeInTheDocument();
  });
});
