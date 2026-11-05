import { describe, expect, it } from "vitest";

import { changeNote, factsLine, warningsFor } from "./editor-facts";

describe("the editor's header", () => {
  it("says where the template comes from, what it copied and how many warbands use it", () => {
    const facts = {
      source: "custom" as const,
      copied_from: { id: 1, name: "Mercenaries" },
      warbands: 1,
    };
    expect(factsLine({ facts })).toBe("Custom · copied from Mercenaries · used by 1 warband");
    expect(factsLine({ facts: { source: "house", copied_from: null, warbands: 3 } })).toBe(
      "The book's, house version · used by 3 warbands"
    );
  });

  it("says once that changes never reach a roster, and that a book template's save makes the house version", () => {
    expect(changeNote({ facts: { source: "house", copied_from: null, warbands: 0 } })).toBe(
      "Changes reach the next recruits and list prices, never units already on a roster."
    );
    expect(changeNote({ facts: { source: "book", copied_from: null, warbands: 0 } })).toMatch(
      /^Saving makes this campaign's house version\. /
    );
  });

  it("finds a section's warnings, and one fighter's by key", () => {
    const warnings = [
      { section: "fighters" as const, key: "", text: "No fighter is the leader." },
      { section: "fighters" as const, key: "hounds", text: "No list" },
    ];
    expect(warningsFor(warnings, "fighters").length).toBe(2);
    expect(warningsFor(warnings, "fighters", "hounds").map((row) => row.text)).toEqual(["No list"]);
    expect(warningsFor(warnings, "lists")).toEqual([]);
  });
});
