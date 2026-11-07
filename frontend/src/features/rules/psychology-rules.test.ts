import { describe, expect, it } from "vitest";

import { psychologyRule, psychologyRulePath } from "./psychology-rules";
import { ruleEntries } from "./rules-index";

describe("a psychology special's part of the rules", () => {
  it("is found by the special's name, its forms and aliases too", () => {
    const titles = (names: string[]) => names.map((name) => psychologyRule(name)?.title ?? null);

    expect(titles(["Fear", "Cause Fear", "Causes Fear", "Fearsome", "Fear (Maximilian)"])).toEqual([
      "Fear",
      "Fear",
      "Fear",
      "Fear",
      "Fear",
    ]);
    expect(titles(["Frenzy", "Hatred", "Hate Orcs and Goblins", "Hates Dark Elves"])).toEqual([
      "Frenzy",
      "Hatred",
      "Hatred",
      "Hatred",
    ]);
    expect(titles(["Stupidity", "Stupid", "Stupidity (Rat Ogre)"])).toEqual([
      "Stupidity",
      "Stupidity",
      "Stupidity",
    ]);
    // no part of their own, and no psychology
    expect(titles(["Immune to Psychology", "Immune to Fear", "Large", "Fearless Leader"])).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("opens a row the Rules page has", () => {
    const ids = new Set(ruleEntries().map((entry) => entry.id));
    for (const name of ["Fear", "Frenzy", "Hatred", "Stupidity"]) {
      const rule = psychologyRule(name);
      expect(rule && ids.has(rule.id)).toBe(true);
    }
    expect(psychologyRulePath(3, { title: "Fear", id: "leadership-psychology-fear" })).toBe(
      "/campaigns/3/rules?open=leadership-psychology-fear"
    );
  });
});
