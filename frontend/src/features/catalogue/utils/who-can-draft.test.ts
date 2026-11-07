import { describe, expect, it } from "vitest";

import {
  addLine,
  draftOf,
  everyone,
  isMixed,
  linesPayload,
  modeOf,
  whoCanMeaning,
  withMode,
} from "./who-can-draft";

const skaven = { kind: "type" as const, id: 3, name: "Skaven" };
const undead = { kind: "group" as const, id: 8, name: "Undead" };
const line = (id: number, name: string, excluded: boolean, group = false) => ({
  warband_type_id: group ? null : id,
  warband_group_id: group ? id : null,
  name,
  excluded,
});

describe("who-can Exclude and Include", () => {
  it("starts on Exclude, for everyone, and adds each line as an exclusion", () => {
    const draft = addLine(everyone(), skaven);

    expect(modeOf(everyone())).toBe("exclude");
    expect(whoCanMeaning(everyone())).toBe("Everyone");
    expect(draft.lines[0].excluded).toBe(true);
    expect(whoCanMeaning(draft)).toBe("Everyone except these");
    expect([draft.forEveryone, linesPayload(draft)]).toEqual([
      true,
      [{ warband_type_id: 3, excluded: true }],
    ]);
  });

  it("on Include lets in only the lines added, and no one with none", () => {
    const empty = withMode(everyone(), "include");
    const draft = addLine(empty, undead);

    expect([modeOf(empty), whoCanMeaning(empty)]).toEqual(["include", "No one"]);
    expect(whoCanMeaning(draft)).toBe("Only these");
    expect([draft.forEveryone, linesPayload(draft)]).toEqual([
      false,
      [{ warband_group_id: 8, excluded: false }],
    ]);
  });

  it("switching the mode turns every line the new way", () => {
    const excluded = addLine(addLine(everyone(), skaven), undead);
    const included = withMode(excluded, "include");

    expect(included.forEveryone).toBe(false);
    expect(included.lines.map((entry) => entry.excluded)).toEqual([false, false]);
    expect(withMode(included, "exclude")).toEqual(excluded);
  });

  it("loads a mixed list (an include and an exclude together) and saves it without loss", () => {
    const stored = {
      for_everyone: false,
      warbands: [line(8, "Undead", false, true), line(5, "Vampire Counts", true)],
    };
    const draft = draftOf(stored);

    expect(isMixed(draft)).toBe(true);
    expect([modeOf(draft), whoCanMeaning(draft)]).toEqual(["include", "Only these"]);
    expect([draft.forEveryone, linesPayload(draft)]).toEqual([
      false,
      [
        { warband_group_id: 8, excluded: false },
        { warband_type_id: 5, excluded: true },
      ],
    ]);
    expect(isMixed(withMode(draft, "include"))).toBe(false);
  });
});
