import { describe, expect, it } from "vitest";

import { myParticipant } from "@/test/battle-fixtures";
import { applyConfigPatch, mergeConfigPatches } from "./unit-information-patch";

describe("unit-information-patch (BUG-44)", () => {
  it("merges two saves per unit, the newer fields winning", () => {
    expect(
      mergeConfigPatches(
        { unit_information_patch: { "hero:1": { current_wounds: 1, notes: "Old" } } },
        {
          unit_information_patch: { "hero:1": { notes: "New" }, "hero:3": { current_wounds: 0 } },
          battle_notes: "Ambush",
        }
      )
    ).toEqual({
      unit_information_patch: {
        "hero:1": { current_wounds: 1, notes: "New" },
        "hero:3": { current_wounds: 0 },
      },
      battle_notes: "Ambush",
    });
  });

  it("applies only the patched fields, keeping kills and out of action", () => {
    const participant = myParticipant({
      unit_information_json: { "hero:1": { kill_count: 2, out_of_action: true, notes: "Hurt" } },
    });

    const next = applyConfigPatch(participant, {
      unit_information_patch: { "hero:1": { current_wounds: 1 }, "hero:3": { notes: "Fresh" } },
    });

    expect(next.unit_information_json["hero:1"]).toMatchObject({
      kill_count: 2,
      out_of_action: true,
      notes: "Hurt",
      current_wounds: 1,
    });
    expect(next.unit_information_json["hero:3"]).toMatchObject({
      notes: "Fresh",
      kill_count: 0,
      current_wounds: null,
    });
    expect(next.selected_unit_keys_json).toBe(participant.selected_unit_keys_json);
  });
});
