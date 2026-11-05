import { describe, expect, it } from "vitest";

import { makeEditorTemplate } from "@/test/template-editor-fixtures";

import { upgradeDraft, upgradeInput } from "./upgrade-draft";

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
