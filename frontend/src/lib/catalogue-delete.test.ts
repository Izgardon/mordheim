import { describe, expect, it } from "vitest";

import { ApiError, SERVER_UNAVAILABLE_MESSAGE } from "./api-client";
import { deleteRefusalMessage, inUseMessage } from "./catalogue-delete";

const inUse = (usage: Record<string, number>) =>
  new ApiError("This item is in use, so nothing was deleted.", 409, {
    detail: "This item is in use, so nothing was deleted.",
    code: "in_use",
    fields: {},
    usage,
  });

describe("inUseMessage", () => {
  it("says how many units in how many warbands, and that nothing was deleted", () => {
    expect(inUseMessage({ units: 3, warbands: 2, stashes: 0, bestiary_entries: 0 })).toBe(
      "Used by 3 units in 2 warbands; nothing was deleted."
    );
  });

  it("speaks in the singular for one, and adds stashes and bestiary entries", () => {
    expect(inUseMessage({ units: 1, warbands: 1, stashes: 1, bestiary_entries: 1 })).toBe(
      "Used by 1 unit and 1 stash in 1 warband, and by 1 bestiary entry; nothing was deleted."
    );
  });

  it("leaves out zero counts", () => {
    expect(inUseMessage({ units: 0, warbands: 1, stashes: 2, bestiary_entries: 0 })).toBe(
      "Used by 2 stashes in 1 warband; nothing was deleted."
    );
    expect(inUseMessage({ units: 0, warbands: 0, stashes: 0, bestiary_entries: 2 })).toBe(
      "Used by 2 bestiary entries; nothing was deleted."
    );
  });

  it("gives nothing when every count is zero", () => {
    expect(inUseMessage({ units: 0, warbands: 0, stashes: 0, bestiary_entries: 0 })).toBeNull();
  });
});

describe("deleteRefusalMessage", () => {
  it("turns a 409 in_use into its counts", () => {
    expect(
      deleteRefusalMessage(inUse({ units: 3, warbands: 2, stashes: 0, bestiary_entries: 0 }), "x")
    ).toBe("Used by 3 units in 2 warbands; nothing was deleted.");
  });

  it("falls back to the refusal's own detail when the counts are all zero", () => {
    expect(
      deleteRefusalMessage(inUse({ units: 0, warbands: 0, stashes: 0, bestiary_entries: 0 }), "x")
    ).toBe("This item is in use, so nothing was deleted.");
  });

  it("reads any other refusal as before", () => {
    expect(deleteRefusalMessage(new ApiError("Forbidden", 403, { detail: "Forbidden" }), "x")).toBe(
      "Forbidden"
    );
    expect(deleteRefusalMessage(new ApiError("down", 503, null), "x")).toBe(
      SERVER_UNAVAILABLE_MESSAGE
    );
  });
});
