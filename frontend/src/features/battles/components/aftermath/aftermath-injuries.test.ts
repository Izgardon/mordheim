import { describe, expect, it } from "vitest";

import type { BattlePostbattleRules } from "@/features/battles/types/battle-types";

import { injuryText, missesDice } from "./aftermath-injuries";

const MANUAL = { kind: "manual" } as const;

const rules = {
  injury_tables: {
    d6: [{ low: 1, high: 2, label: "Dead", effect: { kind: "dead" }, text: "" }],
    d66: [
      { low: 16, high: 21, label: "Multiple Injuries", effect: MANUAL, text: "Roll D6 times." },
      { low: 36, high: 36, label: "Robbed", effect: MANUAL, text: "He keeps nothing." },
    ],
  },
} as unknown as BattlePostbattleRules;

describe("injuryText", () => {
  it("gives every D66 result its book line, the manual ones too", () => {
    expect(injuryText(rules, { roll_type: "d66", result_code: "36" })).toBe("He keeps nothing.");
    expect(injuryText(rules, { roll_type: "d66", result_code: "19" })).toBe("Roll D6 times.");
  });

  it("is blank without a roll, for a table with no text or a code it doesn't hold", () => {
    expect(injuryText(rules, undefined)).toBe("");
    expect(injuryText(rules, { roll_type: "d6", result_code: "1" })).toBe("");
    expect(injuryText(rules, { roll_type: "d100", result_code: "07" })).toBe("");
    expect(injuryText(undefined, { roll_type: "d66", result_code: "36" })).toBe("");
  });
});

describe("missesDice", () => {
  it("is the die a result's missing games are rolled on, or none for a set number", () => {
    expect(missesDice({ games: 0, dice: "D3" })).toBe("D3");
    expect(missesDice({ games: 0, dice: "d6" })).toBe("D6");
    expect(missesDice({ games: 1 })).toBeNull();
    expect(missesDice(undefined)).toBeNull();
  });
});
