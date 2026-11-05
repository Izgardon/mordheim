import { describe, expect, it } from "vitest";

import { makeEditorTemplate } from "@/test/template-editor-fixtures";

import { basicsDraft, basicsInput, lossNote, variantKey, variantLoss } from "./basics-draft";

describe("Basics' save", () => {
  it("sends each variant's terms, a new variant keyed from its name, and drops a preset taken out", () => {
    const template = makeEditorTemplate();
    const draft = basicsDraft(template);
    draft.variants = [
      { ...draft.variants[0], gold: "600", bonus: "1" },
      { key: "", name: "The Hung", gold: "", size: "12", bonus: "", rest: {}, isNew: true },
    ];
    draft.gold = "";
    const sent = basicsInput(draft);
    expect(sent.starting_gold).toBeNull();
    expect(sent.variants).toEqual([
      { key: "reikland", name: "Reikland", starting_gold: 600, rare_bonus: 1 },
      { key: "the-hung", name: "The Hung", max_models: 12 },
    ]);
    // Middenheimers preset Middenheim, which went
    expect(sent.types).toEqual([
      { id: 10, variant: "reikland" },
      { id: 11, variant: "" },
    ]);
    expect(variantKey("Mutiny in Marienburg!")).toBe("mutiny-in-marienburg");
  });

  it("says what a variant taken out takes with it", () => {
    const template = makeEditorTemplate();
    expect(lossNote(variantLoss(template, "middenheim"))).toBe(
      "Its own rule and list line go with it."
    );
    expect(lossNote({ rules: 2, lines: 0 })).toBe("Its own 2 rules go with it.");
    expect(lossNote({ rules: 1, lines: 0 })).toBe("Its own rule goes with it.");
    expect(lossNote({ rules: 0, lines: 0 })).toBe("");
  });
});
