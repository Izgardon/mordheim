/**
 * A rule's pre-battle roll in its catalogue form (William, 5 Nov 2026): the dice the server takes,
 * or none, and what the roll does; a change sends only the two.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import PrebattleRollFields, { prebattlePayload, prebattleValuesOf } from "./PrebattleRollFields";

describe("The pre-battle roll fields", () => {
  it("offers no roll or the dice, and says what the roll does", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    render(
      <PrebattleRollFields
        layout="dialog"
        idPrefix="skill-5"
        values={{ prebattleRoll: "", prebattleText: "Re-deploy D3 models." }}
        onChange={onChange}
      />
    );
    const dice = screen.getByRole("combobox", { name: "Pre-battle roll" });
    expect(
      Array.from((dice as HTMLSelectElement).options).map((option) => option.textContent)
    ).toEqual(["None", "D3", "D6", "2D6", "3D6", "D66"]);
    expect(screen.getByRole("textbox", { name: "What the roll does" })).toHaveValue(
      "Re-deploy D3 models."
    );

    await user.selectOptions(dice, "D3");
    expect(onChange).toHaveBeenLastCalledWith({
      prebattleRoll: "D3",
      prebattleText: "Re-deploy D3 models.",
    });
  });

  it("reads an entry's roll and sends it back trimmed", () => {
    const values = prebattleValuesOf({ prebattle_roll: "D6", prebattle_text: "On a 1. " });
    expect(values).toEqual({ prebattleRoll: "D6", prebattleText: "On a 1. " });
    expect(prebattleValuesOf(undefined)).toEqual({ prebattleRoll: "", prebattleText: "" });
    expect(prebattlePayload(values)).toEqual({ prebattle_roll: "D6", prebattle_text: "On a 1." });
  });
});
