import { describe, expect, it } from "vitest";

import { armourSaveToForm, buildArmourSavePayload, parseArmourSave } from "./unit-form-helpers";

describe("armour save (decision 11)", () => {
  it.each([
    ["5", 5],
    ["5+", 5],
    [" 5 + ", 5],
    ["6+", 6],
    ["0+", 0],
    ["0", 0],
    ["-1+", -1],
    ["-5+", -5],
    ["", null],
    ["  ", null],
  ])("reads %j as %j", (typed, save) => {
    expect(parseArmourSave(typed)).toBe(save);
  });

  it.each(["7+", "7", "-6+", "5++", "+5", "5.5", "abc", "10"])("refuses %j", (typed) => {
    expect(parseArmourSave(typed)).toBeUndefined();
  });

  it("shows a stored save as N+ and sends a refused one as typed", () => {
    expect(armourSaveToForm(5)).toBe("5+");
    expect(armourSaveToForm(-1)).toBe("-1+");
    expect(armourSaveToForm(null)).toBe("");
    expect(buildArmourSavePayload(" 4+ ")).toBe(4);
    expect(buildArmourSavePayload("")).toBeNull();
    expect(buildArmourSavePayload(" 7+ ")).toBe("7+");
  });
});
