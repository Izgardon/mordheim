import { describe, expect, it } from "vitest";

import { makeTemplateUpgrade } from "@/test/template-fixtures";

import { groupNote, upgradeGroups } from "./upgrade-draft";

describe("an upgrade group's note", () => {
  it("is said once for the group, each note once, and is empty without one", () => {
    const mutant = { note: "With the Mutant skill." };
    const upgrades = [
      makeTemplateUpgrade(1, "Great Claw", 50, mutant),
      makeTemplateUpgrade(2, "Tentacle", 35, { note: " With the Mutant skill. " }),
      makeTemplateUpgrade(3, "Suckers", 25, { group: "Blessings of Nurgle" }),
    ];
    const [[, mutations], [, blessings]] = upgradeGroups(upgrades);
    expect(groupNote(mutations)).toBe("With the Mutant skill.");
    expect(groupNote(blessings)).toBe("");
  });
});
