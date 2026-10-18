import { describe, expect, it } from "vitest";

import { parseDiceValues, toD6Values } from "./dice-results";

describe("dice-results", () => {
  it("reads numbers, {rolls} groups and {value} dice from a DiceRoller result", () => {
    expect(parseDiceValues([3, { rolls: [1, { value: 5 }, "x"] }, { value: "6" }])).toEqual([
      3, 1, 5, 6,
    ]);
    expect(parseDiceValues({ value: 4 })).toEqual([4]);
    expect(parseDiceValues(null)).toEqual([]);
  });

  it("keeps D6 values between 1 and 6, at most the dice expected", () => {
    expect(toD6Values([7, 3.9, 2, 5], 3)).toEqual([6, 3, 2]);
    // A zero is no die at all.
    expect(parseDiceValues([0, 2])).toEqual([2]);
  });
});
