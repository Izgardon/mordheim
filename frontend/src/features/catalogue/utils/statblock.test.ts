import { describe, expect, it } from "vitest";

import {
  STAT_LABELS,
  parseItemStatblock,
  profileValues,
  readItemStatblock,
  statInputs,
  statNumbers,
  numberOnly,
  profileInputs,
  statShown,
  statToSend,
  writtenNumber,
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

  it("shows a stat as its number then its written text, a roll alone, nothing as a dash", () => {
    expect([statShown(2, "(2)"), statShown(null, "D6"), statShown(4), statShown(null)]).toEqual([
      "2(2)",
      "D6",
      4,
      "–",
    ]);
  });

  it("sends each box as typed for the server to read, an empty box as 0", () => {
    const sent = ["4", " 1(2) ", "-", "12", ""].map(statToSend);
    expect(sent).toEqual(["4", "1(2)", "-", "12", 0]);
  });

  it("edits a profile's written values as they show, and reads the number one starts with", () => {
    const inputs = profileInputs({
      movement: null,
      attacks: 2,
      weapon_skill: null,
      strength: null,
      written_stats: { movement: "12", attacks: "(2)", weapon_skill: "D6" },
    });
    const shown = [inputs.movement, inputs.attacks, inputs.weapon_skill, inputs.strength];
    expect(shown).toEqual(["12", "2(2)", "D6", ""]);
    expect([numberOnly("1(2)"), numberOnly("D6"), numberOnly("4")]).toEqual(["1", "", "4"]);
  });

  it("saves a profile read back as it was read", () => {
    const written = { movement: "12", attacks: "(2)", weapon_skill: "D6" };
    const inputs = profileInputs({
      movement: null,
      attacks: 2,
      weapon_skill: null,
      written_stats: written,
    });
    expect([inputs.movement, inputs.attacks, inputs.weapon_skill].map(statToSend)).toEqual([
      "12",
      "2(2)",
      "D6",
    ]);
  });
});
