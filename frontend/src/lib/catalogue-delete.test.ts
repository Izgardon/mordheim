import { describe, expect, it } from "vitest";

import { deleteWording, usageSummary } from "./catalogue-delete";

const rope = { name: "Rope", campaign_id: 1 };
const axe = { name: "Axe", campaign_id: null };
const ready = (usage: Record<string, number>) => ({ state: "ready" as const, usage });
const NOTHING = ready({ units: 0, warbands: 0, stashes: 0, bestiary_entries: 0 });

describe("usageSummary", () => {
  it("says how many units in how many warbands", () => {
    expect(usageSummary({ units: 3, warbands: 2, stashes: 0, bestiary_entries: 0 })).toBe(
      "3 units in 2 warbands"
    );
  });

  it("speaks in the singular for one, and adds stashes and bestiary entries", () => {
    expect(usageSummary({ units: 1, warbands: 1, stashes: 1, bestiary_entries: 1 })).toBe(
      "1 unit and 1 stash in 1 warband, and by 1 bestiary entry"
    );
  });

  it("leaves out zero counts, and gives nothing when every count is zero", () => {
    expect(usageSummary({ units: 0, warbands: 1, stashes: 2, bestiary_entries: 0 })).toBe(
      "2 stashes in 1 warband"
    );
    expect(usageSummary({ units: 0, warbands: 0, stashes: 0, bestiary_entries: 2 })).toBe(
      "2 bestiary entries"
    );
    expect(usageSummary({ units: 0, warbands: 0, stashes: 0, bestiary_entries: 0 })).toBeNull();
  });
});

describe("deleteWording (decision 5, CAT-TWEAK-04, CAT-NEW-05)", () => {
  it("deletes an unused custom entry for good", () => {
    expect(deleteWording(rope, NOTHING, "item")).toEqual({
      confirm: "Delete item",
      message: "Delete Rope? Nothing uses it, so it is deleted for good.",
    });
  });

  it("archives a custom entry in use, saying what holds it and that they keep their copies", () => {
    expect(deleteWording(rope, ready({ units: 3, warbands: 2 }), "item")).toEqual({
      confirm: "Archive item",
      message:
        "Archive Rope? It is used by 3 units in 2 warbands; they keep their copies. It leaves the shops and pickers, and you can restore it from Archived.",
    });
  });

  it("removes a book entry from this campaign only, used or not", () => {
    expect(deleteWording(axe, NOTHING, "item")).toEqual({
      confirm: "Remove item",
      message:
        "Remove Axe from this campaign only? The book and other campaigns keep it. You can restore it from Archived.",
    });
    expect(deleteWording(axe, ready({ units: 1, warbands: 1 }), "item").message).toBe(
      "Remove Axe from this campaign only? The book and other campaigns keep it. It is used by 1 unit in 1 warband; they keep their copies. You can restore it from Archived."
    );
  });

  it("says it is still checking, and words a failed check for either outcome", () => {
    expect(deleteWording(rope, { state: "checking" }, "item").message).toBe(
      "Checking what uses Rope…"
    );
    expect(deleteWording(rope, { state: "failed" }, "item")).toEqual({
      confirm: "Delete item",
      message: "Delete Rope? If anything uses it, it is archived instead, and its copies stay.",
    });
  });
});
