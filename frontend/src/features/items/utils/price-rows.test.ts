import { describe, expect, it } from "vitest";

import {
  blankPriceRow,
  PRICE_HINT,
  PRICE_OR_NOTE_HINT,
  priceRowProblems,
  priceRowsOf,
} from "./price-rows";

const row = { id: 1, cost: null, dice: null, dice_multiplier: null, rarity: null, note: "" };
const read = (label: string, cost_note: string) =>
  priceRowsOf([{ ...row, label, cost_note, for_everyone: true, warbands: [] }])[0];

describe("price rows' notes", () => {
  it("holds a label or cost note a row was read with, and a new row neither", () => {
    expect(read("Brace", "").holds).toEqual({ label: true, costNote: false });
    expect(read(" ", "per pair").holds).toEqual({ label: false, costNote: true });
    expect(blankPriceRow().holds).toEqual({ label: false, costNote: false });
  });

  it("asks a row with no price for one, or a cost note where it holds one", () => {
    const problems = priceRowProblems(
      [blankPriceRow(), { ...read("", "see text"), costNote: "" }],
      "p"
    );
    expect(problems).toEqual({ "p.0.cost": PRICE_HINT, "p.1.cost": PRICE_OR_NOTE_HINT });
  });
});
