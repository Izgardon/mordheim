import { describe, expect, it } from "vitest";

import type { WarbandTypeRow } from "../../types/warband-types";
import { linkAfterPick, pickerRows, typeMeta, typeWarning } from "./warband-type-picker";

const setting = (name: string, grade = "1a") => ({
  id: name.length,
  slug: name.toLowerCase(),
  name,
  grade,
});

function type(name: string, overrides: Partial<WarbandTypeRow> = {}): WarbandTypeRow {
  return {
    id: Math.floor(Math.random() * 1e6),
    name,
    slug: name.toLowerCase(),
    campaign_id: null,
    setting: setting("Mordheim"),
    source: "Mordheim Rulebook",
    link_url: `https://mordheimer.example/${name.toLowerCase()}`,
    groups: [],
    race: "Human",
    source_code: "MHR",
    broheim_grade: "1a",
    mordheimer_grade: "core",
    in_play: true,
    ...overrides,
  };
}

const skaven = type("Skaven", { race: "Skaven" });
const pestilens = type("Skaven of Clan Pestilens", {
  race: "Skaven",
  setting: setting("Mousillon", "2b"),
  source: "Mousillon supplement",
  in_play: false,
});
const reiklanders = type("Reiklanders");
const own = type("Gutter Kings", { campaign_id: 3, setting: null, source: "", in_play: true });

describe("pickerRows", () => {
  it("puts the types in play first and lists the rest apart, by name", () => {
    const rows = pickerRows([pestilens, reiklanders, skaven, own], "");
    expect(rows.inPlay.map((row) => row.name)).toEqual(["Gutter Kings", "Reiklanders", "Skaven"]);
    expect(rows.outside.map((row) => row.name)).toEqual(["Skaven of Clan Pestilens"]);
    expect(rows.custom).toBe("");
  });

  it("finds a type by name, race or setting, and offers a new name as a custom type", () => {
    expect(pickerRows([pestilens, reiklanders, skaven], "skav").inPlay).toEqual([skaven]);
    expect(pickerRows([pestilens, reiklanders, skaven], "mousillon").outside).toEqual([pestilens]);
    expect(pickerRows([skaven], " skav ").custom).toBe("skav");
    expect(pickerRows([skaven], "SKAVEN").custom).toBe("");
  });

  it("leaves out the types already picked", () => {
    expect(pickerRows([skaven, reiklanders], "", [skaven.id]).inPlay).toEqual([reiklanders]);
  });
});

describe("typeMeta and typeWarning", () => {
  it("names the setting and source, a custom type as the campaign's own, and warns out of play", () => {
    expect(typeMeta(pestilens)).toBe("Mousillon · Mousillon supplement");
    expect(typeMeta(own)).toBe("Custom · this campaign");
    expect(typeMeta({ ...pestilens, source: "Mousillon" })).toBe("Mousillon");
    expect(typeWarning(pestilens)).toBe("Mousillon isn't in this campaign");
    expect(typeWarning(skaven)).toBe("");
  });
});

describe("linkAfterPick", () => {
  it("fills an empty field or the old type's link, and keeps the player's own", () => {
    expect(linkAfterPick("", null, skaven)).toBe(skaven.link_url);
    expect(linkAfterPick(reiklanders.link_url, reiklanders, skaven)).toBe(skaven.link_url);
    expect(linkAfterPick("https://my.example/sheet", reiklanders, skaven)).toBe(
      "https://my.example/sheet"
    );
  });
});
