import { describe, expect, it } from "vitest";

import {
  STAT_LABELS,
  parseItemStatblock,
  profileValues,
  readItemStatblock,
  statInputs,
  statNumbers,
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
