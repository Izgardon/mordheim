import { describe, expect, it } from "vitest";

import { makeEditorTemplate } from "@/test/template-editor-fixtures";

import type { RuleDraft } from "./rule-draft";
import { upgradeDraft, upgradeInput, withRule } from "./upgrade-draft";

const rule = (name: string, cost: number | null): RuleDraft => ({
  special_id: name.length,
  name,
  kind: "boon",
  category: "mutation",
  description: "",
  cost,
});

describe("picking an upgrade's special", () => {
  it("fills in its price as the cost, and a later pick's while the cost is still a default", () => {
    const picked = withRule(upgradeDraft(null, "Mutations"), rule("Great Claw", 50));
    expect(picked.cost).toBe("50");
    expect(withRule(picked, rule("Wings", 45)).cost).toBe("45"); // the last pick's own
    expect(withRule(picked, rule("Warts", null)).cost).toBe("50"); // no price: the cost stays
  });

  it("keeps a cost that was typed", () => {
    const typed = {
      ...withRule(upgradeDraft(null, "Mutations"), rule("Great Claw", 50)),
      cost: "25",
    };
    expect(withRule(typed, rule("Wings", 45)).cost).toBe("25");
    const saved = upgradeDraft(makeEditorTemplate().upgrades[0]); // a saved upgrade's cost is its own
    expect(withRule(saved, rule("Wings", 45)).cost).toBe(saved.cost);
  });
});

describe("an upgrade's save", () => {
  it("sends its special, its cost (empty for none, 0 for free) and its terms", () => {
    const [upgrade] = makeEditorTemplate().upgrades;
    const draft = { ...upgradeDraft(upgrade), cost: "0", most: "1" };
    expect(upgradeInput(draft)).toMatchObject({
      id: 30,
      rule: { special_id: 300 },
      cost: 0,
      max_per_fighter: 1,
    });
    expect(upgradeInput({ ...draft, cost: "" })?.cost).toBeNull();
    expect(upgradeInput({ ...upgradeDraft(null, "Mutations") })).toBeNull(); // no rule picked yet
  });
});
