import { describe, expect, it } from "vitest";

import {
  STAT_LABELS,
  parseItemStatblock,
  profileValues,
  readItemStatblock,
  statInputs,
  statNumbers,
  isWritten,
  numberOnly,
  profileInputs,
  statShown,
  statToSend,
  writtenNumber,
  writtenStale,
} from "./statblock";

describe("stat lines", () => {
  it("starts every characteristic at one value, with overrides", () => {
    expect(statInputs("0", { wounds: "1", attacks: "1" })).toEqual({
      movement: "0",
      weapon_skill: "0",
      ballistic_skill: "0",
      strength: "0",
      toughness: "0",
      wounds: "1",
      initiative: "0",
      attacks: "1",
      leadership: "0",
    });
  });

  it("turns the form's text into numbers, anything else into 0", () => {
    expect(statNumbers(statInputs("", { movement: "6", strength: "x", wounds: "2" }))).toEqual({
      movement: 6,
      weapon_skill: 0,
      ballistic_skill: 0,
      strength: 0,
      toughness: 0,
      wounds: 2,
      initiative: 0,
      attacks: 0,
      leadership: 0,
    });
  });

  it("lists a stored profile in profile order", () => {
    const profile = statNumbers(statInputs("3", { movement: "4", leadership: "7" }));
    expect(profileValues(profile)).toEqual([4, 3, 3, 3, 3, 3, 3, 3, 7]);
    expect(STAT_LABELS).toEqual(["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"]);
  });
});

describe("item statblocks", () => {
  it("reads the JSON the forms write, blank where a stat is missing", () => {
    expect(parseItemStatblock(JSON.stringify({ M: 7, S: "4" }))).toMatchObject({
      M: "7",
      S: "4",
      WS: "",
      Ld: "",
    });
  });

  it("reads the older 'M: 4, WS: 3' text, and leaves blank what it can't read", () => {
    expect(parseItemStatblock("M: 4, ws: 3, nonsense")).toMatchObject({ M: "4", WS: "3", S: "" });
    expect(parseItemStatblock(null)).toEqual(parseItemStatblock(""));
  });

  it("reads JSON, single-quoted or bare-key text for display, and null for anything else", () => {
    expect(readItemStatblock('{"M": 4}')).toEqual({ M: 4 });
    expect(readItemStatblock("{M: 4, 'WS': 3}")).toEqual({ M: 4, WS: 3 });
    expect(readItemStatblock("[[table]] stats")).toBeNull();
  });
});

describe("written stats", () => {
  it("reads the number a written value starts with, and none from a roll or a dash", () => {
    expect(["1(2)", "5*", "3(6)", "1+1"].map(writtenNumber)).toEqual([1, 5, 3, 1]);
    expect(["2D6", "D6", "d3", "-"].map(writtenNumber)).toEqual([null, null, null, null]);
  });

  it("shows a written value as written, a number as itself and nothing as a dash", () => {
    expect([statShown(1, "1(2)"), statShown(4), statShown(null)]).toEqual(["1(2)", 4, "–"]);
  });

  it("flags a written value only once its number has moved", () => {
    expect(writtenStale(1, "1(2)")).toBe(false);
    expect(writtenStale(2, "1(2)")).toBe(true);
    expect(writtenStale(null, "D6")).toBe(false);
    expect(writtenStale(4, "D6")).toBe(true);
    expect(writtenStale(4)).toBe(false);
  });

  it("sends a plain number as a number, a written value as typed, an empty box as 0", () => {
    expect([statToSend("4"), statToSend(" 1(2) "), statToSend("-"), statToSend("")]).toEqual([
      4,
      "1(2)",
      "-",
      0,
    ]);
  });

  it("edits a profile's written values as written, and turns them back into numbers", () => {
    const inputs = profileInputs({
      attacks: 1,
      weapon_skill: null,
      written_stats: { attacks: "1(2)" },
    });
    expect([inputs.attacks, inputs.weapon_skill]).toEqual(["1(2)", ""]);
    expect([isWritten("1(2)"), isWritten("4"), isWritten("")]).toEqual([true, false, false]);
    expect([numberOnly("1(2)"), numberOnly("D6"), numberOnly("4")]).toEqual(["1", "", "4"]);
  });
});
