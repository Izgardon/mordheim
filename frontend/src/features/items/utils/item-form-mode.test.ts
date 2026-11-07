/**
 * What only the item form's Advanced shows: an item holding any of it opens in Advanced, and a
 * refusal under one of those fields shows Advanced, so neither is hidden in Simple.
 */
import { describe, expect, it } from "vitest";

import { availability, item } from "@/test/catalogue-fixtures";

import { hidesAnError, holdsAdvanced } from "./item-form-mode";
import { itemValuesOf } from "./item-form-values";

describe("holdsAdvanced", () => {
  it("is false for a new item and for one price for everyone with nothing more", () => {
    expect(holdsAdvanced(itemValuesOf(null))).toBe(false);
    expect(holdsAdvanced(itemValuesOf(item({ tags: ["axe"], variant: "Mutiny" })))).toBe(false);
  });

  it("is true for a label or cost note a price holds, and for a link", () => {
    expect(
      holdsAdvanced(itemValuesOf(item({ availabilities: [availability({ label: "Brace" })] })))
    ).toBe(true);
    expect(
      holdsAdvanced(itemValuesOf(item({ availabilities: [availability({ cost_note: "a pair" })] })))
    ).toBe(true);
    expect(holdsAdvanced(itemValuesOf(item({ link_url: "https://example.org" })))).toBe(true);
  });
});

describe("hidesAnError", () => {
  it("is true only for a refusal under a field Simple hides", () => {
    expect(hidesAnError({ name: "Taken.", availabilities: "Add at least one price." })).toBe(false);
    expect(hidesAnError({ "availabilities.0.cost": "Needs a price of 0 or more." })).toBe(false);
    expect(hidesAnError({ "availabilities.0.warbands": "Unknown warband type." })).toBe(true);
    expect(hidesAnError({ "availabilities.1.cost": "Needs a price of 0 or more." })).toBe(true);
  });
});
