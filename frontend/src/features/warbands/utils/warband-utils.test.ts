import { describe, expect, it } from "vitest";

import {
  buildAvailableSkillsPayload,
  logFeatureLabel,
  parseAvailableSkills,
} from "./warband-utils";

describe("available skills", () => {
  it("turns the form's checkboxes into full type names, dropping the Spc flag", () => {
    expect(
      buildAvailableSkillsPayload({ C: true, Sh: false, A: true, Spc: true, Necromancy: true })
    ).toEqual(["Combat", "Academic", "Necromancy"]);
  });

  it("parses both the list format and the legacy dict back into checkboxes", () => {
    expect(parseAvailableSkills(["Combat", "Necromancy"])).toEqual({
      C: true,
      Sh: false,
      A: false,
      St: false,
      Sp: false,
      Necromancy: true,
      Spc: true,
    });
    expect(parseAvailableSkills({ Sh: true, Necromancy: true })).toEqual({
      C: false,
      Sh: true,
      A: false,
      St: false,
      Sp: false,
      Spc: false,
      Necromancy: true,
    });
    expect(parseAvailableSkills(null)).toEqual({
      C: false,
      Sh: false,
      A: false,
      St: false,
      Sp: false,
      Spc: false,
    });
  });
});

describe("the log's filters", () => {
  // William, 7 Nov 2026: "warband log capital letters on filters"
  it("are capitalised, with spaces for underscores", () => {
    expect(["personnel", "hero_special", "loadout"].map(logFeatureLabel)).toEqual([
      "Personnel",
      "Hero special",
      "Loadout",
    ]);
  });
});
