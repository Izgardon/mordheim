import { describe, expect, it } from "vitest";

import type { Spell } from "@/features/spells/types/spell-types";

import {
  HENCHMEN_TABLE,
  HERO_TABLE,
  d6Stat,
  rowFor,
  spellDifficulty,
  spellRollResult,
  statChange,
} from "./advance-table";

const spell = (fields: Partial<Spell>): Spell => ({
  id: 1,
  name: "Spell",
  type: "Necromancy",
  ...fields,
});

describe("the advance tables", () => {
  it("find the row a 2D6 lands on", () => {
    expect(rowFor(HERO_TABLE, 4)?.outcome).toEqual({ kind: "skill" });
    expect(rowFor(HERO_TABLE, 7)?.outcome).toEqual({ kind: "choose", stats: ["WS", "BS"] });
    expect(rowFor(HERO_TABLE, 12)?.outcome).toEqual({ kind: "skill" });
    expect(rowFor(HENCHMEN_TABLE, 6)?.outcome).toEqual({ kind: "choose", stats: ["WS", "BS"] });
    expect(rowFor(HENCHMEN_TABLE, 11)?.outcome).toEqual({ kind: "talent" });
    expect(rowFor(HERO_TABLE, null)).toBeUndefined();
  });

  it("split a D6 follow-up at 3", () => {
    expect(d6Stat({ low: "S", high: "A" }, 3)).toBe("S");
    expect(d6Stat({ low: "S", high: "A" }, 4)).toBe("A");
  });

  it("show a stat change against the race maximum", () => {
    expect(statChange("S", 3, 4)).toEqual({ text: "S 3 → 4 (max 4)", overMax: false });
    expect(statChange("S", 4, 4)).toEqual({ text: "S 4 → 5 (max 4)", overMax: true });
    expect(statChange("Ld", 7, null)).toEqual({ text: "Ld 7 → 8", overMax: false });
  });
});

describe("spells", () => {
  it("show his own difficulty", () => {
    expect(spellDifficulty("7", -1)).toBe("7 → 6");
    expect(spellDifficulty("7")).toBe("7");
    expect(spellDifficulty("Auto", -1)).toBe("Auto");
  });

  it("find the spell a roll lands on, and lower one he knows", () => {
    const lore = [spell({ id: 1, roll: 1, dc: "9" }), spell({ id: 2, roll: 2, dc: "Auto" })];
    expect(spellRollResult(lore, [], 1)).toMatchObject({ known: false, difficulty: "9" });
    const known = [spell({ id: 1, dc: "9", dc_change: -1 })];
    expect(spellRollResult(lore, known, 1)).toMatchObject({ known: true, difficulty: "8 → 7" });
    expect(spellRollResult(lore, [spell({ id: 2, dc: "Auto" })], 2)).toMatchObject({
      known: true,
      difficulty: "Auto",
    });
    expect(spellRollResult(lore, [], 5)).toBeNull();
  });
});
