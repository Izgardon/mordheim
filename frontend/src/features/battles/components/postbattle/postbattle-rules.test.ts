import { describe, expect, it } from "vitest";

import { postbattleRules } from "@/test/battle-fixtures";

import {
  explorationAmount,
  explorationDiceLimits,
  explorationTableRows,
  heroDeathRollFor,
  seriousInjuryRoll,
} from "./postbattle-rules";

describe("postbattle-rules: the server's rules (IMP-52)", () => {
  it("reads exploration amounts and the tooltip's rows from the server's table", () => {
    const rules = postbattleRules();
    expect(explorationAmount(rules, [])).toBe(0);
    expect(explorationAmount(rules, [3, 4])).toBe(2);
    expect(explorationAmount(rules, [6, 6, 6, 6, 6, 6, 6])).toBe(7);
    expect(explorationTableRows(rules)).toEqual([
      { diceResult: "1-5", shardsFound: "1" },
      { diceResult: "6-11", shardsFound: "2" },
      { diceResult: "12-17", shardsFound: "3" },
      { diceResult: "18-24", shardsFound: "4" },
      { diceResult: "25-30", shardsFound: "5" },
      { diceResult: "31-35", shardsFound: "6" },
      { diceResult: "36+", shardsFound: "7" },
    ]);
  });

  it("looks serious injuries up in the server's tables: d6, the campaign's d66 or d100", () => {
    expect(seriousInjuryRoll("henchman", [2], postbattleRules())).toMatchObject({
      roll_type: "d6",
      result_code: "2",
      result_label: "Dead",
      dead_suggestion: true,
    });
    expect(seriousInjuryRoll("hero", [2, 6], postbattleRules())).toMatchObject({
      roll_type: "d66",
      rolls: [2, 6],
      result_code: "26",
      result_label: "Horrible Scars",
      dead_suggestion: false,
      effect: { kind: "special", special: "Horrible Scars" },
    });
    expect(seriousInjuryRoll("hero", [7], postbattleRules("d100"))).toMatchObject({
      roll_type: "d100",
      result_code: "07",
      result_label: "Dead",
      dead_suggestion: true,
    });
  });

  it("still works without the rules (an older server): defaults, no amounts, the chart by hand", () => {
    expect(explorationAmount(undefined, [3, 4])).toBe(0);
    expect(explorationTableRows(undefined)).toEqual([]);
    expect(explorationDiceLimits(undefined)).toEqual({ max: 10, max_chosen: 6 });
    expect(heroDeathRollFor(undefined)).toBe("d66");
    expect(seriousInjuryRoll("hero", [1, 1], undefined)).toMatchObject({
      roll_type: "d66",
      result_code: "11",
      result_label: "Check the serious injury chart manually",
      dead_suggestion: false,
    });
  });
});
